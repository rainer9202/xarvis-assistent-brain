import { Provider } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
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
    // This app is API-only (no server-rendered frontend of its own), so any
    // browser client lives on a different origin — Better-Auth needs these
    // origins allow-listed to accept cross-site cookie/session requests.
    trustedOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    // Lets non-browser clients (mobile apps, other services) authenticate
    // via `Authorization: Bearer <token>` instead of a session cookie.
    plugins: [bearer()],
    rateLimit: {
      enabled: true, // don't rely on the "production only" default — enable explicitly in every env
      window: 60, // seconds
      max: 20, // generous default across the whole /auth/* surface
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
      },
      // storage stays at its default (`memory`): single-container Dokploy
      // deployment, so no need for `database`/`secondary-storage` yet — memory
      // storage resets on restart and doesn't share state across replicas,
      // revisit only if the app is ever scaled horizontally.
    },
    advanced: {
      ipAddress: {
        // Better-Auth's `getIp()` (used to build the per-client rate-limit
        // bucket key) only trusts a client-supplied `X-Forwarded-For` header
        // when the immediate hop is a known proxy. Without this, either (a)
        // an attacker spoofs a fresh IP on every request and evades the
        // 5-req/60s sign-in/sign-up limit entirely, or (b) once 2+ hops
        // appear in XFF, `getIp()` returns null and every client on that
        // path shares ONE bucket — one abusive client locks out everyone.
        // Defaults to the standard RFC1918 private ranges, which is
        // reasonable for a containerized Dokploy deployment where the
        // reverse proxy sits on the same private Docker network — tighten
        // this to the exact proxy IP/CIDR once it's confirmed in production.
        trustedProxies: (
          process.env.TRUSTED_PROXIES ??
          '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'
        )
          .split(',')
          .map((proxy) => proxy.trim())
          .filter(Boolean),
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const authProvider: Provider = {
  provide: AUTH,
  useFactory: createAuth,
  inject: [PrismaService],
};
