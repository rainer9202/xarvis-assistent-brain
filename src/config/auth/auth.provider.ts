import { Provider } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaService } from '@config/database/prisma.service';

export const AUTH = Symbol('BetterAuth');

function createAuth(prisma: PrismaService) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
    },
    // Prisma model is `AuthAccount` (see schema.prisma) because `Account`
    // is already the ledger's bank-account model — this tells the adapter
    // to call prisma.authAccount instead of the default prisma.account.
    account: {
      modelName: 'authAccount',
    },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL:
      process.env.BETTER_AUTH_URL ??
      `http://localhost:${process.env.PORT ?? 3000}`,
    basePath: '/auth',
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const authProvider: Provider = {
  provide: AUTH,
  useFactory: createAuth,
  inject: [PrismaService],
};
