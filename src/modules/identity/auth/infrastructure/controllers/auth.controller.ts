import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@infra/decorators/public.decorator';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';
import {
  SignUpCommand,
  SignUpUseCase,
} from '../../application/use-cases/sign-up.use-case';
import {
  SignInCommand,
  SignInUseCase,
} from '../../application/use-cases/sign-in.use-case';
import {
  RefreshTokenCommand,
  RefreshTokenUseCase,
} from '../../application/use-cases/refresh-token.use-case';
import {
  LogoutCommand,
  LogoutUseCase,
} from '../../application/use-cases/logout.use-case';
import { GetAllUsersUseCase } from '../../application/use-cases/get-all-users.use-case';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import {
  UpdateProfileCommand,
  UpdateProfileUseCase,
} from '../../application/use-cases/update-profile.use-case';
import { SignUpDto } from '../dto/sign-up.dto';
import { SignInDto } from '../dto/sign-in.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { LogoutDto } from '../dto/logout.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';

// ThrottlerGuard is applied only here (AuthModule scopes its own
// ThrottlerModule.forRoot, see auth.module.ts) — 5 requests per 60s per IP
// on both routes below, replacing Better-Auth's built-in limiter.
@UseGuards(ThrottlerGuard)
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly signUp: SignUpUseCase,
    private readonly signIn: SignInUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getAllUsers: GetAllUsersUseCase,
    private readonly getProfile: GetProfileUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
  ) {}

  @Public()
  @Post('sign-up')
  @ApiCreatedResponse({ description: 'User registered' })
  async signUpOne(@Body() dto: SignUpDto) {
    return {
      message: 'The user was registered successfully',
      data: await this.signUp.execute(
        new SignUpCommand(dto.name, dto.email, dto.password, dto.birthDate),
      ),
    };
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Signed in' })
  async signInOne(@Body() dto: SignInDto) {
    return {
      message: 'Signed in successfully',
      data: await this.signIn.execute(
        new SignInCommand(dto.email, dto.password),
      ),
    };
  }

  // @Public() — exchanging a refresh token is the whole point of not
  // having a live access token anymore. No @SkipThrottle(): this is a
  // security-sensitive credential-exchange endpoint, same brute-force
  // exposure class as sign-up/sign-in, so it stays under the class-level
  // ThrottlerGuard (5 req/60s).
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Access and refresh tokens rotated' })
  async refreshOne(@Body() dto: RefreshDto) {
    return {
      message: 'Tokens refreshed successfully',
      data: await this.refreshToken.execute(
        new RefreshTokenCommand(dto.refreshToken),
      ),
    };
  }

  // @Public() — authority to log out is possession of the refresh token
  // itself, not a live access token, so a client can log out even after
  // its access token has expired (spec's "Revoke a refresh token via
  // logout" requirement). Idempotent: an unknown/already-revoked token
  // still returns 200 (LogoutUseCase never throws).
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Refresh token revoked' })
  async logoutOne(@Body() dto: LogoutDto) {
    await this.logout.execute(new LogoutCommand(dto.refreshToken));
    return { message: 'Logged out successfully', data: null };
  }

  // No @Public() — the global JwtAuthGuard (APP_GUARD in app.module.ts)
  // already protects this route by default, so a missing/expired token
  // yields 401 with zero extra code (design.md ADR-5). @SkipThrottle() opts
  // this handler out of the class-level ThrottlerGuard (5 req/60s), which is
  // scoped for sign-up/sign-in brute-force protection, not profile reads
  // (design.md ADR-6) — without it, a profile screen reading on focus could
  // spuriously hit 429.
  @SkipThrottle()
  @Get('me')
  @ApiOkResponse({ description: 'Authenticated user profile' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: 'The profile was found successfully',
      data: await this.getProfile.execute(user.id),
    };
  }

  // See getMe() above for the @SkipThrottle() / no-@Public() rationale
  // (design.md ADR-5, ADR-6). Returns the FULL profile, not { id } — a
  // documented exception, see UpdateProfileUseCase (design.md ADR-4).
  @SkipThrottle()
  @Patch('me')
  @ApiOkResponse({ description: 'Profile updated' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return {
      message: 'The profile was updated successfully',
      data: await this.updateProfile.execute(
        new UpdateProfileCommand(user.id, dto.name, dto.birthDate),
      ),
    };
  }

  // Debug-only endpoint, no auth guard and no ownership scoping — lists
  // every user in the system. Fail-closed: hidden (404, same as a
  // nonexistent route) unless DEBUG_ROUTES_ENABLED is explicitly set to
  // "true" (see EnvironmentVariables). Opt-in rather than deleted, so it
  // stays available for local debugging — but unlike a check keyed off
  // NODE_ENV, a forgotten/misconfigured env var in any real deployment can
  // never accidentally leave this reachable, since the default is hidden.
  @Public()
  @Get('users')
  @ApiOkResponse({ description: 'List of all users (dev-only, unsecured)' })
  async findAllUsers() {
    if (process.env.DEBUG_ROUTES_ENABLED !== 'true') {
      throw new NotFoundException();
    }
    return {
      message: 'Get all users successfully',
      data: await this.getAllUsers.execute(),
    };
  }
}
