// Resend/Svix webhook signature verification, inline (WebCrypto) — no `svix` dependency.
// Svix signs `${svix-id}.${svix-timestamp}.${rawBody}` with HMAC-SHA256 using the secret
// (a base64 payload after the `whsec_` prefix). The `svix-signature` header carries one or
// more space-separated `v1,<base64sig>` entries; a match on any is valid. We also reject
// timestamps skewed more than 5 minutes to blunt replay.

const TOLERANCE_SECONDS = 5 * 60

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let binary = ''
  for (const b of arr)
    binary += String.fromCharCode(b)
  return btoa(binary)
}

// Constant-time compare (avoids leaking match length via early exit).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length)
    return false
  let diff = 0
  for (let i = 0; i < a.length; i++)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export interface SvixHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

export async function verifyResendSignature(secret: string, rawBody: string, headers: SvixHeaders): Promise<boolean> {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature)
    return false

  const ts = Number(headers.timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS)
    return false

  const secretBytes = base64ToBytes(secret.startsWith('whsec_') ? secret.slice(6) : secret)
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = `${headers.id}.${headers.timestamp}.${rawBody}`
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed))
  const expected = bytesToBase64(mac)

  // Header may hold several signatures: "v1,<sig> v1,<sig2>"
  return headers.signature.split(' ').some((entry) => {
    const sig = entry.includes(',') ? entry.split(',')[1] : entry
    return !!sig && timingSafeEqual(sig, expected)
  })
}
