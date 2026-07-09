import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@shared/decorators/public.decorator';
import {
  SignUpCommand,
  SignUpUseCase,
} from '../../application/use-cases/sign-up.use-case';
import {
  SignInCommand,
  SignInUseCase,
} from '../../application/use-cases/sign-in.use-case';
import { SignUpDto } from '../dto/sign-up.dto';
import { SignInDto } from '../dto/sign-in.dto';

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
  ) {}

  @Public()
  @Post('sign-up')
  @ApiCreatedResponse({ description: 'User registered' })
  async signUpOne(@Body() dto: SignUpDto) {
    return {
      message: 'The user was registered successfully',
      data: await this.signUp.execute(
        new SignUpCommand(dto.name, dto.email, dto.password),
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
}
