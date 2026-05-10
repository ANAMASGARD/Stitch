import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify `x-hub-signature-256` for a GitHub webhook delivery (HMAC SHA-256 of raw body).
 * Compares digests with timing-safe equality; checks buffer lengths first so malformed
 * signatures do not throw.
 */
export function verifyGitHubWebhookSignature256(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const receivedHex = signatureHeader.slice("sha256=".length).trim();
  const expectedHex = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    const received = Buffer.from(receivedHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    if (received.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
