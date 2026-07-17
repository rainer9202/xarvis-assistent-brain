import { UserEntity } from '../../domain/entities/user.entity';
import { buildUserProfile } from './build-user-profile';

describe('buildUserProfile', () => {
  it('maps id, name, email and formats birthDate to YYYY-MM-DD', () => {
    const user = new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed-password',
      birthDate: new Date('1990-05-20T00:00:00Z'),
    });

    const result = buildUserProfile(user);

    expect(result).toEqual({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      birthDate: '1990-05-20',
    });
  });

  it('returns null birthDate when the entity value is null', () => {
    const user = new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed-password',
      birthDate: null,
    });

    const result = buildUserProfile(user);

    expect(result.birthDate).toBeNull();
  });

  it('returns null birthDate when the entity value is undefined', () => {
    const user = new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed-password',
    });

    const result = buildUserProfile(user);

    expect(result.birthDate).toBeNull();
  });

  // Pins the UTC round-trip documented in design.md ADR-2: birthDate is
  // persisted as UTC-midnight by the sign-up path, so toISOString().slice(0,10)
  // returns exactly the same calendar date that was originally sent in, with
  // no off-by-one-day drift.
  it('pins the UTC round-trip of a known date', () => {
    const user = new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed-password',
      birthDate: new Date('2001-12-31T00:00:00.000Z'),
    });

    const result = buildUserProfile(user);

    expect(result.birthDate).toBe('2001-12-31');
  });
});
