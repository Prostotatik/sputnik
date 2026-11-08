const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Rejects cross-site state-changing requests (CSRF): mutations must come from this origin.
 * Browsers send Sec-Fetch-Site and Origin on cross-site POST/PATCH/DELETE.
 */
export function isAllowedMutation(method: string, headers: Headers, host: string | null): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}
