/**
 * True only for absolute http(s) URLs with no whitespace (mirrors the DB CHECK
 * `^https?://[^\s]+$` on license_url/source_url). Rejects javascript:, data:,
 * vbscript:, protocol-relative ("//host"), empty and unparsable values.
 * Anything rendered as an href is re-validated here (defense in depth).
 */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value || /\s/.test(value)) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Hostname of a safe http(s) URL, or null when the value is not safe. */
export function safeUrlHostname(value: string | null | undefined): string | null {
  if (!isSafeHttpUrl(value)) return null;
  return new URL(value).hostname;
}
