// Express's `trust proxy` setting (wired in main.ts) decides which hops in
// front of the app are allowed to set `X-Forwarded-For` — this in turn
// drives @nestjs/throttler's default `ThrottlerGuard.getTracker`, which
// keys rate-limit buckets off `req.ip`. Without a correct trust-proxy
// config behind Dokploy's reverse proxy, either every client collapses into
// one shared bucket (one abusive client locks out everyone) or, if trust
// proxy is naively enabled without restricting to known hops, a client can
// spoof `X-Forwarded-For` and evade rate limiting entirely.
//
// Same split/trim/filter parsing as CORS_ORIGINS. Defaults to the standard
// RFC1918 private ranges, reasonable for the current single-container
// Dokploy setup where the reverse proxy sits on the same private Docker
// network — tighten this to the exact proxy IP/CIDR once confirmed in
// production. Note `??` only falls back on null/undefined: an explicitly
// blank TRUSTED_PROXIES means "trust no proxies," not "use the default."
export function getTrustedProxies(): string[] {
  return (
    process.env.TRUSTED_PROXIES ?? '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'
  )
    .split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);
}
