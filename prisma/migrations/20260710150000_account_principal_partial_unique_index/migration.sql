-- Closes a TOCTOU race in CreateAccountUseCase: two concurrent "first
-- account" creations for the same brand-new user can both read
-- countByUserId() === 0 and both attempt isPrincipal: true. This partial
-- unique index lets only one such row exist per user at a time, so the
-- second concurrent INSERT hits a unique-constraint violation instead of
-- silently succeeding — PrismaAccountRepository.save() catches it (P2002)
-- and retries as a non-principal account.
CREATE UNIQUE INDEX "accounts_user_id_principal_unique" ON "accounts"("user_id") WHERE "is_principal" = true;
