/**
 * AES-256-GCM envelope encryption on Web Crypto (blueprint §8, copied
 * near-verbatim — self-contained, Workers-native). The KEK accepts either a
 * base64 32-byte key or any other string, hashed to 32 bytes via SHA-256 (so
 * a plain dev string works without base64 encoding).
 */

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function importKey(kek: string): Promise<CryptoKey> {
  let keyBytes: Uint8Array;
  try {
    const decoded = base64Decode(kek);
    keyBytes = decoded.length === 32 ? decoded : await sha256(kek);
  } catch {
    keyBytes = await sha256(kek);
  }
  return crypto.subtle.importKey("raw", keyBytes as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function sha256(value: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(hash);
}

export interface SealedSecret {
  ciphertext: string; // base64
  iv: string; // base64
}

export async function sealSecret(plaintext: string, kek: string): Promise<SealedSecret> {
  const key = await importKey(kek);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit random IV per encryption
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    ciphertext: base64Encode(new Uint8Array(ciphertextBuf)),
    iv: base64Encode(iv),
  };
}

export async function openSecret(sealed: SealedSecret, kek: string): Promise<string> {
  const key = await importKey(kek);
  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(sealed.iv) },
    key,
    base64Decode(sealed.ciphertext),
  );
  return new TextDecoder().decode(plaintextBuf);
}
