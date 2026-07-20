# User Default Template Specification

## Purpose

Every new user is provisioned with an owned, editable default set of Accounts, Categories, and Groups at sign-up, retiring the global-category (`userId: null`) concept. This spec also covers the resulting `Category.userId` schema constraint, category read behavior, and the backfill for users who signed up before this feature existed.

## Requirements

### Requirement: Default template provisioned at sign-up

The system MUST provision a default Account/Category/Group set for every new user as part of `POST /auth/sign-up`, scoped to the newly created `userId`.

- Accounts (exactly 3): `Principal` (`AT02`, `isPrincipal: true`), `Ahorro` (`AT04`), `Efectivo` (`AT01`). None has `creditLimitCents` set.
- Categories (exactly 15): the verbatim `DEFAULT_CATEGORIES` set.
- Groups (exactly 2): `Casa`, `Gastos Hormigas`. Neither has `budgetCents` set.

#### Scenario: New sign-up provisions the full default template

- GIVEN a new user submits valid sign-up data
- WHEN `POST /auth/sign-up` completes successfully
- THEN the new user owns exactly 3 accounts (`Principal`/`AT02`/`isPrincipal:true`, `Ahorro`/`AT04`, `Efectivo`/`AT01`), 15 categories (`DEFAULT_CATEGORIES`), and 2 groups (`Casa`, `Gastos Hormigas`)
- AND `Principal` is the only account with `isPrincipal: true`

#### Scenario: Sign-up must not leave a partially-provisioned user

- GIVEN a new user submits valid sign-up data
- WHEN user creation succeeds but provisioning the default template fails
- THEN the sign-up MUST NOT leave that user with a partial or zero-default account/category/group set

### Requirement: Category.userId is a required field

`Category.userId` MUST be required (non-nullable). Every category row MUST belong to exactly one user; a global/shared category (`userId: null`) MUST NOT exist. The `(name, movementType, userId)` uniqueness constraint MUST be preserved.

#### Scenario: Category is always persisted with an owner

- GIVEN a request to create a category
- WHEN the category is persisted
- THEN the row MUST have a non-null `userId` equal to the requesting user's id

### Requirement: Category read paths return only the caller's own categories

`GET /categories` and any other category read path (e.g. get-by-id) MUST return only categories owned by the authenticated user. The system MUST NOT merge in rows with `userId: null`.

#### Scenario: Existing user lists categories after migration

- GIVEN an existing user (created before this feature) has completed the backfill migration
- WHEN the client sends `GET /categories`
- THEN the response contains only that user's own category rows, with no `userId: null` row included and no duplicates

### Requirement: isCustom field behavior (OPEN — resolved by design)

Deferred from the proposal: `GetAllCategoriesUseCase` currently always returns `isCustom: true` since there is no longer a global row to contrast against. Design MUST choose one of:

- (a) keep `isCustom`, hardcoded/derived `true`, preserving the existing frontend contract, or
- (b) remove `isCustom` from the response, after confirming no frontend consumer depends on it.

The option design selects becomes the binding requirement for tasks/apply; this spec records both candidates pending that decision.

### Requirement: Pre-existing users receive the default template via backfill

Every user that existed before this feature MUST end up with the same default Account/Category/Group set a new sign-up produces, without disturbing data the user already created.

#### Scenario: Existing user with no accounts gets exactly the default set

- GIVEN an existing user has zero accounts, zero categories, and zero groups
- WHEN the backfill migration runs
- THEN the user ends up owning exactly `Principal`(`AT02`,`isPrincipal:true`)/`Ahorro`(`AT04`)/`Efectivo`(`AT01`) accounts, the 15 `DEFAULT_CATEGORIES`, and `Casa`/`Gastos Hormigas` groups
- AND `Principal` remains the user's only `isPrincipal: true` account

#### Scenario: Existing Movements keep valid category references after backfill

- GIVEN an existing user has Movements referencing a global (`userId: null`) category
- WHEN the backfill migration runs and global rows are retired
- THEN every affected Movement's `category` reference resolves to that user's own equivalent category row, never to a deleted or missing category
