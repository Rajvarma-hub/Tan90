// Characters people do not mix up when reading a password aloud (no 0/O, 1/l/I).
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random password for an admin to hand to someone, who then changes it from their account page. */
export function generatePassword(length = 12): string {
  const limit = 256 - (256 % ALPHABET.length); // reject values that would favour the first letters
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of bytes) {
      if (byte < limit && out.length < length) out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}
