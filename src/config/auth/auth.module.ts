import { Global, Module } from '@nestjs/common';
import { AUTH, authProvider } from './auth.provider';

@Global()
@Module({
  providers: [authProvider],
  exports: [AUTH],
})
export class AuthModule {}
