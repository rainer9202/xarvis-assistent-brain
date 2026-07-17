import { UserEntity } from '../../domain/entities/user.entity';

export type UserProfileResponse = {
  id: string;
  name: string;
  email: string;
  birthDate: string | null; // 'YYYY-MM-DD'
};

// Shared by GetProfileUseCase and UpdateProfileUseCase so both endpoints
// return a byte-identical shape (design.md ADR-2). Lives under
// application/shared/ (not application/use-cases/) — see
// build-auth-response.ts for the established precedent of this convention.
//
// Formatting via toISOString().slice(0, 10) is correct only because
// birthDate is persisted as UTC-midnight by the sign-up path
// (`new Date(command.birthDate)` on a plain 'YYYY-MM-DD' string parses as
// UTC midnight). If a future write path ever stores a non-midnight or
// local-tz Date, this could drift by a day — see ADR-2's timezone gotcha.
export function buildUserProfile(user: UserEntity): UserProfileResponse {
  return {
    id: user.id!,
    name: user.name,
    email: user.email,
    birthDate: user.birthDate
      ? user.birthDate.toISOString().slice(0, 10)
      : null,
  };
}
