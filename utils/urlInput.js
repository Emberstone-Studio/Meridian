const WEB_PROTOCOL = /^https?:/i;
const PROTOCOL_RELATIVE = /^\/\//;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function isValidIpv4(hostname) {
  if (!IPV4.test(hostname)) return false;
  return hostname.split(".").every((part) => Number(part) <= 255);
}

function hasDomainShape(hostname) {
  const normalized = hostname.replace(/\.$/, "");
  if (!normalized.includes(".")) return false;
  return normalized.split(".").every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
  );
}

/**
 * Return a safe, normalized web URL when input clearly looks navigable.
 * Ambiguous text remains a search query.
 */
export function normalizeUrlInput(value) {
  const input = String(value ?? "").trim();
  if (!input || /\s/.test(input)) return null;

  let candidate = input;
  if (PROTOCOL_RELATIVE.test(candidate)) {
    candidate = `https:${candidate}`;
  } else if (!WEB_PROTOCOL.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;

  // An explicit HTTP(S) scheme is an unambiguous navigation request.
  if (WEB_PROTOCOL.test(input)) return parsed.href;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    parsed.hostname.startsWith("[");
  const isIpv4 = isValidIpv4(hostname);
  if (!isLocal && !isIpv4 && !hasDomainShape(hostname)) {
    return null;
  }
  if (isLocal || isIpv4) parsed.protocol = "http:";

  return parsed.href;
}
