# Delta for Auth

## MODIFIED Requirements

### Requirement: User registration issues authentication tokens

The system SHALL provide a `POST /auth/sign-up` endpoint that creates a user, hashes the submitted password, provisions that user's default Account/Category/Group template (see `user-default-template` spec), and returns `{ id, accessToken, refreshToken }`. The refresh token SHALL be persisted (hashed at rest) and associated with the created user.

(Previously: sign-up created only the User row and issued tokens — no Accounts, Categories, or Groups were provisioned.)

#### Scenario: Successful sign-up

- GIVEN a request body with valid `email`, `password`, `name`, and `birthDate`
- WHEN the client sends `POST /auth/sign-up`
- THEN the response is `201` with `data` containing `id`, `accessToken`, and `refreshToken`
- AND the returned `refreshToken` can be exchanged via `POST /auth/refresh`
- AND the created user owns the default Account/Category/Group template (see `user-default-template` spec)
