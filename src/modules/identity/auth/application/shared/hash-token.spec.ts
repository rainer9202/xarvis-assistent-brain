import { createHash } from 'node:crypto';
import { hashToken } from './hash-token';

describe('hashToken', () => {
  it('returns the sha256 hex digest of the input', () => {
    const token = 'some-jwt-token-value';

    const result = hashToken(token);

    expect(result).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('is deterministic — same input always produces the same hash', () => {
    expect(hashToken('same-token')).toBe(hashToken('same-token'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});
