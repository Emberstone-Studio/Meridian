const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeHomepageUrl(value) {
  const candidate = value.trim();
  if (!candidate) return "";

  try {
    const url = new URL(candidate);
    return SUPPORTED_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
