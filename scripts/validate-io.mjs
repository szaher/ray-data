import fs from "node:fs/promises";
import path from "node:path";
import dns from "node:dns/promises";
import { classifyExternalUrl, isPrivateAddress } from "./validate-lib.mjs";

export async function checkLocalLinks(links, sourceFile, rootDir) {
  const errors = [];
  const sourceDir = path.dirname(sourceFile);

  for (const link of links) {
    const cleaned = link.replace(/[?#].*$/, "");
    if (!cleaned) continue;

    const resolved = cleaned.startsWith("/")
      ? path.join(rootDir, cleaned.replace(/^\//, ""))
      : path.join(sourceDir, cleaned);

    try {
      await fs.access(resolved);
    } catch {
      errors.push(`Broken local link or asset '${link}'.`);
    }
  }

  return errors;
}

function stripFragment(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

async function resolveAndCheckDns(hostname) {
  try {
    const addresses = await dns.resolve4(hostname).catch(() => []);
    const addresses6 = await dns.resolve6(hostname).catch(() => []);
    const all = [...addresses, ...addresses6];
    for (const addr of all) {
      if (isPrivateAddress(addr)) {
        return { safe: false, reason: `DNS resolved to private address: ${addr}` };
      }
    }
    return { safe: true };
  } catch {
    return { safe: true };
  }
}

function validateRedirectTarget(location) {
  if (!location) {
    return { safe: false, reason: "Redirect with no Location header" };
  }
  try {
    const parsed = new URL(location);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { safe: false, reason: `Redirect to non-HTTP(S) scheme: ${parsed.protocol}` };
    }
    if (parsed.username || parsed.password) {
      return { safe: false, reason: "Redirect target contains credentials" };
    }
    if (
      parsed.hostname === "localhost" ||
      isPrivateAddress(parsed.hostname)
    ) {
      return {
        safe: false,
        reason: `Redirect to private/reserved address: ${parsed.hostname}`,
      };
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: `Invalid redirect URL: ${location}` };
  }
}

async function probeUrl(url) {
  const MAX_REDIRECTS = 3;
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch {
        return { ok: false, warning: `Invalid URL: ${currentUrl}` };
      }

      const dnsCheck = await resolveAndCheckDns(parsed.hostname);
      if (!dnsCheck.safe) {
        return { ok: false, error: dnsCheck.reason };
      }

      const response = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "ray-data-validator/1.0" },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        const redirectCheck = validateRedirectTarget(location);
        if (!redirectCheck.safe) {
          return { ok: false, error: redirectCheck.reason };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (response.status === 405 || response.status === 501) {
        const getController = new AbortController();
        const getTimeout = setTimeout(() => getController.abort(), 5000);
        try {
          const getResponse = await fetch(currentUrl, {
            method: "GET",
            redirect: "manual",
            signal: getController.signal,
            headers: {
              "User-Agent": "ray-data-validator/1.0",
              Range: "bytes=0-0",
            },
          });
          getResponse.body?.cancel();
          if (getResponse.ok || getResponse.status === 206) {
            return { ok: true };
          }
          return {
            ok: false,
            warning: `HTTP ${getResponse.status} for ${url}`,
          };
        } finally {
          clearTimeout(getTimeout);
        }
      }

      if (response.ok) {
        return { ok: true };
      }

      return { ok: false, warning: `HTTP ${response.status} for ${url}` };
    } catch (err) {
      if (err.name === "AbortError") {
        return { ok: false, warning: `Timeout fetching ${url}` };
      }
      return { ok: false, warning: `Network error for ${url}: ${err.message}` };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, warning: `Too many redirects for ${url}` };
}

export async function checkExternalLinks(urls) {
  const errors = [];
  const warnings = [];
  const cache = new Map();

  const unique = [];
  for (const url of urls) {
    const safety = classifyExternalUrl(url);
    if (!safety.safe) {
      errors.push(safety.reason);
      continue;
    }
    const normalized = stripFragment(url);
    if (!cache.has(normalized)) {
      cache.set(normalized, null);
      unique.push(normalized);
    }
  }

  const CONCURRENCY = 5;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((u) => probeUrl(u)));
    for (const result of results) {
      if (result.error) {
        errors.push(result.error);
      } else if (result.warning) {
        warnings.push(result.warning);
      }
    }
  }

  return { errors, warnings };
}
