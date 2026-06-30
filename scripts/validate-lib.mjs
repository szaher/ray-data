import matter from "gray-matter";

export function findAll(pattern, text) {
  const re = new RegExp(pattern.source, pattern.flags);
  return Array.from(text.matchAll(re));
}

export function parseFrontmatter(raw) {
  try {
    const { data, content } = matter(raw);
    return { data, content, error: null };
  } catch (err) {
    return { data: {}, content: raw, error: err.message };
  }
}

export function checkFrontmatter(raw) {
  const errors = [];
  const warnings = [];
  const { data, content, error } = parseFrontmatter(raw);

  if (error) {
    errors.push(`Malformed YAML frontmatter: ${error}`);
    return { errors, warnings, data: {}, content };
  }

  for (const field of ["title", "description"]) {
    if (!(field in data)) {
      errors.push(`Missing frontmatter field '${field}'.`);
    } else if (typeof data[field] !== "string") {
      errors.push(`Frontmatter '${field}' must be a string.`);
    } else if (data[field].trim() === "") {
      errors.push(`Frontmatter '${field}' must not be empty.`);
    }
  }

  return { errors, warnings, data, content };
}

export function stripCodeBlocks(body) {
  let result = body.replace(/```[\s\S]*?```/g, "");
  result = result.replace(/=\{`[\s\S]*?`\}/g, "");
  return result;
}

export function checkDiagramFallback(body) {
  const errors = [];
  const DIAGRAM_REGEX = /<(?:Diagram|MermaidDiagram)\b/g;
  for (const match of findAll(DIAGRAM_REGEX, body)) {
    const nextComponent = body.slice(match.index + 1).search(/\n\s*<[A-Z/]/);
    const end =
      nextComponent === -1 ? body.length : match.index + 1 + nextComponent;
    const componentSource = body.slice(match.index, end);
    if (!/\sfallback=/.test(componentSource)) {
      errors.push("Diagram is missing fallback text.");
    }
  }
  return errors;
}

export function extractLinks(body) {
  const clean = stripCodeBlocks(body);

  const inlineLinks = [];
  for (const m of findAll(/(?<!!)\[([^\]]*)\]\(([^)]+)\)/g, clean)) {
    inlineLinks.push({ text: m[1], url: m[2] });
  }
  for (const m of findAll(/href=["']([^"']+)["']/g, clean)) {
    inlineLinks.push({ text: "", url: m[1] });
  }
  for (const m of findAll(/src=["']([^"']+)["']/g, clean)) {
    inlineLinks.push({ text: "", url: m[1] });
  }

  const referenceDefinitions = new Map();
  const defRegex = /^\[([^\]]+)\]:\s+<?(\S+?)>?(?:\s+"[^"]*")?$/gm;
  for (const m of findAll(defRegex, clean)) {
    const label = m[1].toLowerCase();
    if (!referenceDefinitions.has(label)) {
      referenceDefinitions.set(label, { url: m[2], count: 1 });
    } else {
      referenceDefinitions.get(label).count++;
    }
  }

  const bodyWithoutDefs = clean.replace(defRegex, "");
  const bodyWithoutInlineLinks = bodyWithoutDefs.replace(
    /(?<!!)\[([^\]]*)\]\([^)]+\)/g,
    "",
  );
  const bodyWithoutImages = bodyWithoutInlineLinks.replace(
    /!\[[^\]]*\]\[[^\]]*\]/g,
    "",
  );
  const bodyWithoutEscaped = bodyWithoutImages.replace(/\\\[/g, "");

  const referenceLabelUsages = new Map();
  const fullRefUsage = /\[([^\]]+)\]\[([^\]]+)\]/g;
  for (const m of findAll(fullRefUsage, bodyWithoutEscaped)) {
    const label = m[2].toLowerCase();
    referenceLabelUsages.set(label, (referenceLabelUsages.get(label) || 0) + 1);
  }
  const shortcutRefUsage = /(?<!\])\[([^\]]+)\](?!\(|:|\[)/g;
  for (const m of findAll(shortcutRefUsage, bodyWithoutEscaped)) {
    const label = m[1].toLowerCase();
    if (referenceDefinitions.has(label)) {
      referenceLabelUsages.set(
        label,
        (referenceLabelUsages.get(label) || 0) + 1,
      );
    }
  }

  return { inlineLinks, referenceDefinitions, referenceLabelUsages };
}

export function classifyLink(url) {
  if (/^mailto:|^tel:|^data:/.test(url)) {
    return { type: "skip", url };
  }
  if (url.startsWith("#")) {
    return { type: "fragment", url };
  }
  if (/^https?:\/\//i.test(url)) {
    return { type: "external", url };
  }
  if (url.startsWith("/")) {
    return { type: "route", url };
  }
  return { type: "local", url };
}

export function classifyExternalUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: `Invalid URL: ${url}` };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Non-HTTP(S) scheme: ${parsed.protocol}` };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: "URL contains credentials" };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost") {
    return { safe: false, reason: "URL points to localhost" };
  }

  if (isPrivateAddress(hostname)) {
    return { safe: false, reason: `URL points to private/reserved address: ${hostname}` };
  }

  return { safe: true };
}

export function isPrivateAddress(hostnameOrIp) {
  if (hostnameOrIp === "localhost") return true;

  if (hostnameOrIp === "::1" || hostnameOrIp === "[::1]") return true;

  const ipv4Match = hostnameOrIp.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }

  const bare = hostnameOrIp.replace(/^\[|\]$/g, "").toLowerCase();
  if (bare === "::1") return true;
  if (bare.startsWith("fe80:")) return true;
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true;
  if (bare.startsWith("::ffff:")) {
    const mapped = bare.slice(7);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mapped)) {
      return isPrivateAddress(mapped);
    }
    const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const a = (hi >> 8) & 0xff;
      const b = hi & 0xff;
      const c = (lo >> 8) & 0xff;
      const d = lo & 0xff;
      return isPrivateAddress(`${a}.${b}.${c}.${d}`);
    }
  }

  return false;
}

export function detectLinkIssues(extracted) {
  const errors = [];
  const warnings = [];
  const { referenceDefinitions, referenceLabelUsages } = extracted;

  for (const [label] of referenceLabelUsages) {
    if (!referenceDefinitions.has(label)) {
      errors.push(`Undefined reference label '[${label}]'.`);
    }
  }

  for (const [label, def] of referenceDefinitions) {
    if (def.count > 1) {
      warnings.push(`Duplicate reference definition for '[${label}]'.`);
    }
  }

  return { errors, warnings };
}

export function checkRiskyClaimPatterns(body) {
  const warnings = [];
  const riskyClaimPattern =
    /\b(best|most popular|guaranteed|always|never|latest)\b/i;
  const verifyBlocks = findAll(
    /<VerifyClaim[\s\S]*?<\/VerifyClaim>/g,
    body,
  ).map((m) => m[0]);
  const bodyWithoutVerifyBlocks = verifyBlocks.reduce(
    (text, block) => text.replace(block, ""),
    body,
  );
  if (riskyClaimPattern.test(bodyWithoutVerifyBlocks)) {
    warnings.push("Potential unsupported claim outside VerifyClaim.");
  }
  return warnings;
}

export function checkDuplicateParagraphs(body) {
  const warnings = [];
  const paragraphs = body
    .split(/\n{2,}/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => item.length > 80 && !item.startsWith("```"));
  const seen = new Set();
  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) {
      warnings.push("Duplicate paragraph content detected.");
    }
    seen.add(paragraph);
  }
  return warnings;
}
