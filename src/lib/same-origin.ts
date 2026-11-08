const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Hostnames (without port) allowed to reach the API: loopback plus SPUTNIK_ALLOWED_HOSTS (comma-separated). */
export function allowedHostnames(env: string | undefined = process.env.SPUTNIK_ALLOWED_HOSTS): Set<string> {
  const extra = (env ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...LOCAL_HOSTNAMES, ...extra]);
}

function hostnameOf(hostHeader: string): string | null {
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Blocks DNS rebinding (unknown Host) for every request and cross-site state-changing requests (CSRF).
 * Origins are checked against the allowlist, never against the attacker-controllable Host header.
 */
export function isAllowedRequest(method: string, headers: Headers, allowed: Set<string> = allowedHostnames()): boolean {
  const host = hostnameOf(headers.get("host") ?? "");
  if (!host || !allowed.has(host)) return false;
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = headers.get("origin");
  if (origin) {
    try {
      return allowed.has(new URL(origin).hostname.toLowerCase());
    } catch {
      return false;
    }
  }
  return true;
}
