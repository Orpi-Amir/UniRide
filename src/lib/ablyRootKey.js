/**
 * Ably root keys look like: APP_ID.KEY_ID:SECRET
 * Whitespace / line breaks from copy-paste break signing and trigger "invalid key parameter".
 */
export function parseAblyRootKey(raw) {
  let key = typeof raw === "string" ? raw.replace(/^\uFEFF/, "").trim() : "";
  key = key.replace(/\r|\n/g, "").trim();

  if (!key) {
    return {
      ok: false,
      error: "ABLY_API_KEY is missing in environment variables",
    };
  }

  const colonIdx = key.lastIndexOf(":");
  if (colonIdx <= 0 || colonIdx === key.length - 1) {
    return {
      ok: false,
      error:
        "ABLY_API_KEY is not a valid Ably root key. In Ably Dashboard → API Keys, copy the full root key (format APP_ID.KEY_ID:SECRET).",
    };
  }

  const keyNamePart = key.slice(0, colonIdx);
  const secretPart = key.slice(colonIdx + 1);
  if (!keyNamePart.includes(".") || secretPart.length < 8) {
    return {
      ok: false,
      error:
        "ABLY_API_KEY does not match Ably’s expected shape. Use the complete root key, not only the Key ID or secret.",
    };
  }

  return { ok: true, key };
}
