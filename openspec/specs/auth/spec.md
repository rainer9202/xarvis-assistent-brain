# Auth Specification

## Requirements

### Requirement: Retrieve authenticated user profile

The system SHALL provide a GET /auth/me endpoint that returns the authenticated user's profile data.

#### Scenario: Authenticated user requests their profile

- GIVEN a valid bearer token for an existing user
- WHEN the client sends GET /auth/me
- THEN the response is 200 with data containing id, name, email, birthDate

#### Scenario: Missing or expired token

- GIVEN no bearer token, or a bearer token that has expired
- WHEN the client sends GET /auth/me
- THEN the response is 401 Unauthorized, same shape as any other protected route

### Requirement: Update authenticated user profile

The system SHALL provide a PATCH /auth/me endpoint that lets the authenticated user update name and/or birthDate. The system SHALL NOT accept email or password on this endpoint.

#### Scenario: Update name and birth date

- GIVEN a valid bearer token
- WHEN the client sends PATCH /auth/me with { "name": "New Name", "birthDate": "1995-05-20" }
- THEN the response is 200 with the full updated profile (id, name, email, birthDate)
- AND a subsequent GET /auth/me reflects the updated name and birthDate

#### Scenario: Partial update

- GIVEN a valid bearer token
- WHEN the client sends PATCH /auth/me with only { "name": "New Name" }
- THEN only name is updated and birthDate is left unchanged, and the response still returns the full profile

#### Scenario: Attempt to change email or password via this endpoint

- GIVEN a valid bearer token
- WHEN the client sends PATCH /auth/me including email and/or password fields
- THEN those fields SHALL be silently stripped (same whitelist: true behavior as every other DTO) and the response SHALL NOT change email/password
