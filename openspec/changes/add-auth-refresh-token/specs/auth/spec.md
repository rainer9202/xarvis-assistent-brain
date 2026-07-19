# Delta for Auth

## ADDED Requirements

### Requirement: Exchange a refresh token for new tokens

The system SHALL provide a `POST /auth/refresh` endpoint, marked `@Public`, that exchanges a valid, unexpired, unrevoked refresh token for a new access token and a new refresh token (rotation). The presented refresh token SHALL be looked up by its hash and, on success, SHALL be marked revoked (single-use) before the new pair is issued.

#### Scenario: Valid refresh token

- GIVEN a refresh token issued at a previous sign-up/sign-in/refresh that has not expired or been revoked
- WHEN the client sends `POST /auth/refresh` with that token
- THEN the response is `200` with a new `accessToken` and a new, rotated `refreshToken`
- AND the presented refresh token is marked revoked and can no longer be exchanged

#### Scenario: Unknown, malformed, or expired refresh token

- GIVEN a refresh token that does not exist, is malformed, or has expired
- WHEN the client sends `POST /auth/refresh` with that token
- THEN the response is `401 Unauthorized`

#### Scenario: Reuse of an already-revoked refresh token

- GIVEN a refresh token that was already exchanged or revoked
- WHEN the client sends `POST /auth/refresh` with that same token again
- THEN the response is `401 Unauthorized`, identical in shape to the unknown-token case
- AND the token remains revoked (defensive re-revoke is a no-op, not an error)

### Requirement: Revoke a refresh token via logout

The system SHALL provide a `POST /auth/logout` endpoint, marked `@Public`, that revokes the refresh token supplied in the request body. Authority to log out SHALL be the possession of a valid refresh token, not a live access token, so a client can log out after its access token has expired.

#### Scenario: Logout with a valid refresh token

- GIVEN a refresh token that has not yet been revoked
- WHEN the client sends `POST /auth/logout` with `{ "refreshToken": "..." }`
- THEN the response is `200`
- AND a subsequent `POST /auth/refresh` with that token returns `401`

#### Scenario: Logout is idempotent

- GIVEN a refresh token that is already revoked, or does not exist
- WHEN the client sends `POST /auth/logout` with that token
- THEN the response is `200` (no error), identical outcome whether or not the token was already revoked

### Requirement: Boot-time validation of refresh token configuration

The system SHALL validate `REFRESH_JWT_SECRET` (required, minimum length 32, distinct from `JWT_SECRET`) and `REFRESH_JWT_EXPIRES_IN` (optional, default `30d`, same integer-seconds-or-`ms`-duration pattern as `JWT_EXPIRES_IN`) at application boot, failing fast before the app serves any request.

#### Scenario: Missing or too-short secret

- GIVEN `REFRESH_JWT_SECRET` is unset or shorter than 32 characters
- WHEN the application starts
- THEN the application SHALL fail to boot with a validation error

#### Scenario: Malformed expiry duration

- GIVEN `REFRESH_JWT_EXPIRES_IN` is set to a value that is neither a plain integer-seconds string nor a valid `ms`-style duration
- WHEN the application starts
- THEN the application SHALL fail to boot with a validation error

#### Scenario: Valid configuration with default expiry

- GIVEN `REFRESH_JWT_SECRET` is a valid 32+ character string and `REFRESH_JWT_EXPIRES_IN` is omitted
- WHEN the application starts
- THEN the application SHALL boot successfully using `30d` as the refresh token lifetime

## MODIFIED Requirements

### Requirement: User registration issues authentication tokens

The system SHALL provide a `POST /auth/sign-up` endpoint that creates a user, hashes the submitted password, and returns `{ id, accessToken, refreshToken }`. The refresh token SHALL be persisted (hashed at rest) and associated with the created user.
(Previously: returned `{ id, accessToken }` only, with no refresh token issued or persisted.)

#### Scenario: Successful sign-up

- GIVEN a request body with valid `email`, `password`, `name`, and `birthDate`
- WHEN the client sends `POST /auth/sign-up`
- THEN the response is `201` with `data` containing `id`, `accessToken`, and `refreshToken`
- AND the returned `refreshToken` can be exchanged via `POST /auth/refresh`

### Requirement: User sign-in issues authentication tokens

The system SHALL provide a `POST /auth/sign-in` endpoint that verifies credentials and returns `{ id, accessToken, refreshToken }`. Each successful sign-in SHALL issue a new refresh token, independent of any refresh tokens issued by prior sign-ins for the same user.
(Previously: returned `{ id, accessToken }` only, with no refresh token issued or persisted.)

#### Scenario: Successful sign-in

- GIVEN valid credentials for an existing user
- WHEN the client sends `POST /auth/sign-in`
- THEN the response is `200` with `data` containing `id`, `accessToken`, and `refreshToken`

#### Scenario: Invalid credentials

- GIVEN an unknown email, or a known email with a wrong password
- WHEN the client sends `POST /auth/sign-in`
- THEN the response is `401 Unauthorized`, with no `accessToken` or `refreshToken` issued, same timing-safe behavior as before this change
