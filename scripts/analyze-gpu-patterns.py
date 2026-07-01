#!/usr/bin/env python3
"""Analyze a Python code snippet for GPU patterns using AST and tokenize.

Reads Python source from stdin. Outputs JSON with:
  markers    — gpu-example / cpu-alternative / gpu-resource-reference comment markers
  violations — hardcoded CUDA device patterns
  gpu_reservations — num_gpus, ray_actor_options, ScalingConfig(use_gpu=True)
  parse_error — null or {line, message} if ast.parse fails
  token_fallback — present only when AST parse fails; contains violations/reservations
                   found via tokenize (or raw-text if tokenize also fails)
  api_calls  — scheduling API calls found (map_batches, bind, ScalingConfig, serve.deployment)
"""

import ast
import io
import json
import re
import sys
import tokenize


_RESOURCE_REF_PATTERNS = {
    "omit num_gpus": "num_gpus",
    'omit ray_actor_options["num_gpus"]': "actor_options",
    "set use_gpu=False": "scaling_config",
}


def extract_markers(source):
    markers = []
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except tokenize.TokenError:
        return markers
    for tok in tokens:
        if tok.type == tokenize.COMMENT:
            val = tok.string.strip()
            if val.startswith("# gpu-example:"):
                marker_id = val[len("# gpu-example:"):].strip()
                markers.append({"type": "gpu-example", "id": marker_id, "line": tok.start[0]})
            elif val.startswith("# cpu-alternative:"):
                marker_id = val[len("# cpu-alternative:"):].strip()
                markers.append({"type": "cpu-alternative", "id": marker_id, "line": tok.start[0]})
            elif val.startswith("# gpu-resource-reference:"):
                ref_text = val[len("# gpu-resource-reference:"):].strip()
                api = None
                for prefix, api_type in _RESOURCE_REF_PATTERNS.items():
                    if ref_text.startswith(prefix):
                        api = api_type
                        break
                markers.append({
                    "type": "gpu-resource-reference",
                    "api": api,
                    "line": tok.start[0],
                })
    return markers


def _is_cuda_string(node):
    return isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value in ("cuda", "cuda:0")


def _is_cuda_int(node):
    return isinstance(node, ast.Constant) and isinstance(node.value, int) and node.value == 0


def _is_zero_value(node):
    """Check if node is the constant 0 or 0.0."""
    if not isinstance(node, ast.Constant):
        return False
    return node.value == 0 or node.value == 0.0


def _is_torch_cuda_is_available(node):
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if not isinstance(func, ast.Attribute) or func.attr != "is_available":
        return False
    val = func.value
    if isinstance(val, ast.Attribute) and val.attr == "cuda":
        if isinstance(val.value, ast.Name) and val.value.id == "torch":
            return True
    return False


def _is_torch_device_call(node):
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if isinstance(func, ast.Attribute) and func.attr == "device":
        if isinstance(func.value, ast.Name) and func.value.id == "torch":
            return True
    return False


def _is_torch_cuda_set_device(node):
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if not isinstance(func, ast.Attribute) or func.attr != "set_device":
        return False
    val = func.value
    if isinstance(val, ast.Attribute) and val.attr == "cuda":
        if isinstance(val.value, ast.Name) and val.value.id == "torch":
            return True
    return False


def _is_scaling_config_call(node):
    """Check if a Call node targets ScalingConfig (bare or qualified)."""
    func = node.func
    if isinstance(func, ast.Name) and func.id == "ScalingConfig":
        return True
    if isinstance(func, ast.Attribute) and func.attr == "ScalingConfig":
        return True
    return False


def _get_call_name(node):
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Name):
        return node.id
    return None


class GpuPatternVisitor(ast.NodeVisitor):
    def __init__(self):
        self.violations = []
        self.gpu_reservations = []
        self.api_calls = []

    def visit_Call(self, node):
        if isinstance(node.func, ast.Attribute) and node.func.attr == "cuda":
            parent_name = ""
            if isinstance(node.func.value, ast.Name):
                parent_name = node.func.value.id
            if parent_name != "torch":
                self.violations.append({
                    "pattern": ".cuda()",
                    "line": node.lineno,
                    "detail": "Bare .cuda() call — use .to(device) with device detection",
                })

        if isinstance(node.func, ast.Attribute) and node.func.attr == "to":
            if node.args and _is_cuda_string(node.args[0]):
                self.violations.append({
                    "pattern": f'.to("{node.args[0].value}")',
                    "line": node.lineno,
                    "detail": "Hardcoded .to() device — use .to(device) with device detection",
                })

        if _is_torch_device_call(node):
            if node.args:
                arg = node.args[0]
                if _is_cuda_string(arg):
                    self.violations.append({
                        "pattern": f'torch.device("{arg.value}")',
                        "line": node.lineno,
                        "detail": "Hardcoded torch.device() — use conditional: torch.device('cuda' if torch.cuda.is_available() else 'cpu')",
                    })
                elif isinstance(arg, ast.IfExp):
                    if not _is_torch_cuda_is_available(arg.test):
                        self.violations.append({
                            "pattern": "torch.device(IfExp)",
                            "line": node.lineno,
                            "detail": "torch.device() conditional must use torch.cuda.is_available() as the test",
                        })

        if _is_torch_cuda_set_device(node):
            self.violations.append({
                "pattern": "torch.cuda.set_device()",
                "line": node.lineno,
                "detail": "Explicit CUDA device pinning",
            })

        call_name = _get_call_name(node.func)
        is_scaling = _is_scaling_config_call(node)

        for kw in node.keywords:
            if kw.arg == "device":
                if _is_cuda_string(kw.value):
                    self.violations.append({
                        "pattern": f'device="{kw.value.value}"',
                        "line": kw.value.lineno if hasattr(kw.value, "lineno") else node.lineno,
                        "detail": "Hardcoded device keyword — use device detection",
                    })
                elif _is_cuda_int(kw.value):
                    self.violations.append({
                        "pattern": "device=0",
                        "line": kw.value.lineno if hasattr(kw.value, "lineno") else node.lineno,
                        "detail": "Hardcoded device index — use device detection",
                    })

            if kw.arg == "num_gpus" and not _is_zero_value(kw.value):
                self.gpu_reservations.append({
                    "type": "num_gpus",
                    "line": kw.value.lineno if hasattr(kw.value, "lineno") else node.lineno,
                })

            if kw.arg == "ray_actor_options" and isinstance(kw.value, ast.Dict):
                for key, val in zip(kw.value.keys, kw.value.values):
                    if isinstance(key, ast.Constant) and key.value == "num_gpus":
                        if not _is_zero_value(val):
                            self.gpu_reservations.append({
                                "type": "actor_options_num_gpus",
                                "line": kw.value.lineno if hasattr(kw.value, "lineno") else node.lineno,
                            })

            if kw.arg == "use_gpu" and is_scaling:
                if isinstance(kw.value, ast.Constant) and kw.value.value is True:
                    self.gpu_reservations.append({
                        "type": "scaling_config_use_gpu",
                        "line": kw.value.lineno if hasattr(kw.value, "lineno") else node.lineno,
                    })

        if call_name in ("map_batches", "map", "flat_map"):
            self.api_calls.append({"type": "ray_data_transform", "name": call_name, "line": node.lineno})
        elif call_name == "bind":
            self.api_calls.append({"type": "serve_bind", "name": "bind", "line": node.lineno})
        elif is_scaling:
            self.api_calls.append({"type": "scaling_config", "name": "ScalingConfig", "line": node.lineno})

        self.generic_visit(node)

    def visit_Assign(self, node):
        self._check_device_assignment(node.targets, node.value, node.lineno)
        self.generic_visit(node)

    def visit_AnnAssign(self, node):
        if node.value and node.target:
            self._check_device_assignment([node.target], node.value, node.lineno)
        self.generic_visit(node)

    def _check_device_assignment(self, targets, value, lineno):
        for target in targets:
            name = None
            if isinstance(target, ast.Name):
                name = target.id
            elif isinstance(target, ast.Attribute):
                name = target.attr
            if name in ("device", "self.device") or (isinstance(target, ast.Attribute) and target.attr == "device"):
                attr_name = target.attr if isinstance(target, ast.Attribute) else name
                if attr_name == "device":
                    if _is_cuda_string(value):
                        self.violations.append({
                            "pattern": f'{name} = "{value.value}"' if name else f'device = "{value.value}"',
                            "line": lineno,
                            "detail": "Hardcoded device assignment — use torch.device() with is_available() check",
                        })
                    elif _is_cuda_int(value):
                        self.violations.append({
                            "pattern": f"{name} = 0" if name else "device = 0",
                            "line": lineno,
                            "detail": "Hardcoded device index assignment — use torch.device() with is_available() check",
                        })


def _check_for_serve_deployment(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) or isinstance(node, ast.ClassDef):
            for dec in node.decorator_list:
                if isinstance(dec, ast.Attribute) and dec.attr == "deployment":
                    return True
                if isinstance(dec, ast.Call):
                    func = dec.func
                    if isinstance(func, ast.Attribute) and func.attr == "deployment":
                        return True
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Attribute) and func.attr == "deployment":
                return True
    return False


def _token_fallback(source):
    """When AST parse fails, try tokenize for GPU pattern detection."""
    result = {
        "violations": [],
        "gpu_reservations": [],
        "tokenize_failed": False,
    }

    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except tokenize.TokenError:
        result["tokenize_failed"] = True
        result.update(_raw_text_fallback(source))
        return result

    executable = [
        t for t in tokens
        if t.type in (tokenize.NAME, tokenize.OP, tokenize.STRING, tokenize.NUMBER)
    ]

    for i, tok in enumerate(executable):
        prev1 = executable[i - 1] if i > 0 else None
        prev2 = executable[i - 2] if i > 1 else None
        next1 = executable[i + 1] if i + 1 < len(executable) else None
        next2 = executable[i + 2] if i + 2 < len(executable) else None

        # .cuda( — OP ".", NAME "cuda", OP "("
        if (tok.type == tokenize.NAME and tok.string == "cuda"
                and prev1 and prev1.type == tokenize.OP and prev1.string == "."
                and next1 and next1.type == tokenize.OP and next1.string == "("):
            # Exclude torch.cuda (part of torch.cuda.is_available etc.)
            if not (prev2 and prev2.type == tokenize.NAME and prev2.string == "torch"):
                result["violations"].append({
                    "pattern": ".cuda()",
                    "line": tok.start[0],
                    "detail": "Token fallback: bare .cuda() call",
                })

        # .to("cuda") — OP ".", NAME "to", OP "(", STRING containing cuda
        if (tok.type == tokenize.NAME and tok.string == "to"
                and prev1 and prev1.type == tokenize.OP and prev1.string == "."
                and next1 and next1.type == tokenize.OP and next1.string == "("):
            if next2 and next2.type == tokenize.STRING:
                sval = next2.string.strip("\"'")
                if sval in ("cuda", "cuda:0"):
                    result["violations"].append({
                        "pattern": f'.to("{sval}")',
                        "line": tok.start[0],
                        "detail": "Token fallback: hardcoded .to() device",
                    })

        # device = "cuda" or device="cuda" — NAME "device", OP "=", STRING
        if (tok.type == tokenize.NAME and tok.string == "device"
                and next1 and next1.type == tokenize.OP and next1.string == "="
                and next2 and next2.type == tokenize.STRING):
            sval = next2.string.strip("\"'")
            if sval in ("cuda", "cuda:0"):
                result["violations"].append({
                    "pattern": f'device="{sval}"',
                    "line": tok.start[0],
                    "detail": "Token fallback: hardcoded device",
                })

        # device = 0 — NAME "device", OP "=", NUMBER 0
        if (tok.type == tokenize.NAME and tok.string == "device"
                and next1 and next1.type == tokenize.OP and next1.string == "="
                and next2 and next2.type == tokenize.NUMBER and next2.string == "0"):
            result["violations"].append({
                "pattern": "device=0",
                "line": tok.start[0],
                "detail": "Token fallback: hardcoded device index",
            })

        # torch.cuda.set_device
        if (tok.type == tokenize.NAME and tok.string == "set_device"
                and prev1 and prev1.type == tokenize.OP and prev1.string == "."):
            result["violations"].append({
                "pattern": "torch.cuda.set_device()",
                "line": tok.start[0],
                "detail": "Token fallback: explicit CUDA device pinning",
            })

        # num_gpus = N (not 0)
        if (tok.type == tokenize.NAME and tok.string == "num_gpus"
                and next1 and next1.type == tokenize.OP and next1.string == "="):
            if next2 and next2.type == tokenize.NUMBER:
                try:
                    val = float(next2.string)
                    if val != 0:
                        result["gpu_reservations"].append({
                            "type": "num_gpus",
                            "line": tok.start[0],
                        })
                except ValueError:
                    result["gpu_reservations"].append({
                        "type": "num_gpus",
                        "line": tok.start[0],
                    })
            elif next2 and next2.type == tokenize.NAME:
                result["gpu_reservations"].append({
                    "type": "num_gpus",
                    "line": tok.start[0],
                })

        # use_gpu = True
        if (tok.type == tokenize.NAME and tok.string == "use_gpu"
                and next1 and next1.type == tokenize.OP and next1.string == "="
                and next2 and next2.type == tokenize.NAME and next2.string == "True"):
            result["gpu_reservations"].append({
                "type": "scaling_config_use_gpu",
                "line": tok.start[0],
            })

    return result


def _raw_text_fallback(source):
    """Last-resort raw text scan when tokenize also fails."""
    violations = []
    gpu_reservations = []

    lines = source.split("\n")
    patterns = [
        (re.compile(r"\.cuda\s*\("), ".cuda()"),
        (re.compile(r"\.to\s*\(\s*[\"']cuda"), '.to("cuda")'),
        (re.compile(r"device\s*=\s*[\"']cuda"), 'device="cuda"'),
        (re.compile(r"device\s*=\s*0(?!\.)"), "device=0"),
        (re.compile(r"torch\.cuda\.set_device"), "torch.cuda.set_device()"),
    ]
    reservation_patterns = [
        (re.compile(r"num_gpus\s*=\s*(?!0(?:\s|,|\)|$))"), "num_gpus"),
        (re.compile(r"use_gpu\s*=\s*True"), "scaling_config_use_gpu"),
    ]

    for i, line in enumerate(lines):
        stripped = line.lstrip()
        if stripped.startswith("#"):
            continue
        for pat, name in patterns:
            if pat.search(line):
                violations.append({
                    "pattern": name,
                    "line": i + 1,
                    "detail": f"Raw text fallback: {name}",
                })
        for pat, rtype in reservation_patterns:
            if pat.search(line):
                gpu_reservations.append({
                    "type": rtype,
                    "line": i + 1,
                })

    return {"violations": violations, "gpu_reservations": gpu_reservations}


def analyze(source):
    result = {
        "markers": extract_markers(source),
        "violations": [],
        "gpu_reservations": [],
        "api_calls": [],
        "parse_error": None,
        "has_serve_deployment": False,
    }

    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        result["parse_error"] = {
            "line": e.lineno or 1,
            "message": str(e.msg) if hasattr(e, "msg") else str(e),
        }
        result["token_fallback"] = _token_fallback(source)
        return result

    visitor = GpuPatternVisitor()
    visitor.visit(tree)

    result["violations"] = visitor.violations
    result["gpu_reservations"] = visitor.gpu_reservations
    result["api_calls"] = visitor.api_calls
    result["has_serve_deployment"] = _check_for_serve_deployment(tree)

    return result


if __name__ == "__main__":
    source = sys.stdin.read()
    result = analyze(source)
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")
