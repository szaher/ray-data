#!/usr/bin/env python3
"""Validate device-aware pattern on CPU."""

import argparse
import torch

parser = argparse.ArgumentParser()
parser.add_argument("--force-cpu", action="store_true",
                    help="Force CPU device selection and assert CPU mode")
args = parser.parse_args()

if args.force_cpu:
    device = torch.device("cpu")
else:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = torch.nn.Linear(4, 2).to(device)
x = torch.randn(3, 4).to(device)
with torch.no_grad():
    y = model(x)

assert y.device.type == device.type, f"Expected {device.type}, got {y.device.type}"
assert y.shape == (3, 2), f"Expected (3, 2), got {y.shape}"
if args.force_cpu:
    assert device.type == "cpu", "force-cpu flag did not select CPU"
print(f"Device-aware pattern OK on {device.type}")
