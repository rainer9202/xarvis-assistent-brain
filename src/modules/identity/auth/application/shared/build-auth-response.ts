import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../domain/entities/user.entity';

export type AuthResponse = {
  id: string;
  accessToken: string;
};

// Shared by SignUpUseCase and SignInUseCase — both need the exact same JWT
// payload shape and { id, accessToken } response once a user is
// authenticated, whether by registering or by signing in. Extracted here
// instead of duplicated per use case (the two were byte-for-byte identical).
// Lives under application/shared/ (not application/use-cases/) since it
// isn't itself a use case — see AGENTS.md's "Module structure" section for
// this convention.
export async function buildAuthResponse(
  jwtService: JwtService,
  user: UserEntity,
): Promise<AuthResponse> {
  const accessToken = await jwtService.signAsync({
    sub: user.id,
    email: user.email,
    name: user.name,
  });

  return { id: user.id!, accessToken };
}
