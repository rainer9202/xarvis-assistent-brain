import { createHash } from 'node:crypto';

// Token material (a refresh JWT) is high-entropy (128+ bits from its HMAC
// signature), unlike a low-entropy user password — a slow, salted hash
// (argon2/bcrypt) buys nothing here and would break the O(1)
// `WHERE token_hash = ?` unique-indexed lookup every refresh/logout call
// needs, since salted hashes are non-deterministic. SHA-256 is deterministic
// and preimage-resistant, which is exactly the property this needs (see
// design.md's "SHA-256 for token-at-rest" ADR).
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
