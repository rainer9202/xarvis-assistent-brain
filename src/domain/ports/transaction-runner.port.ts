// Opaque, domain-owned handle for a unit-of-work's underlying transaction
// client. Aliased to `unknown` on purpose — the concrete Prisma transaction
// client type must never leak into `domain`/`application` (see AGENTS.md's
// enforced dependency rule: domain -> nothing, application -> domain only).
// Only the infrastructure-layer repository that receives it knows how to
// narrow it back to `Prisma.TransactionClient` at the boundary.
export type TransactionContext = unknown;

export interface TransactionRunner {
  // Runs `work` inside a single database transaction. Every write the
  // callback performs (via repositories that accept the passed
  // TransactionContext) commits or rolls back atomically as one unit — if
  // `work` throws, nothing it wrote is persisted.
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

export const TRANSACTION_RUNNER = Symbol('TransactionRunner');
