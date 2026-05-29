# AuthModules Core

`@authmodules/core` is a headless TypeScript package for authentication domain
entities, ports, use cases, and test helpers. It provides the current core
contracts for the AuthModules 0.1.0 baseline without choosing an HTTP framework,
storage backend, provider SDK, UI, or deployment model.

The package is intentionally small. It is useful for building and testing auth
flows around current domain boundaries, while runtime adapters and production
integration packages remain outside this repository.

## Installation

After the package is available from the npm registry:

```sh
npm install @authmodules/core
```

`@authmodules/core` requires Node.js 24 or newer and is published as an ESM
package.

## Public API

The supported public API is the root package entrypoint:

```ts
import {
  createInMemoryTestingKit,
  getSession,
  revokeSession,
  signInWithIdentity,
} from "@authmodules/core";
```

Only symbols exported from `src/index.ts` and exposed through the package root
export are public. Deep imports from `src`, `dist`, or internal modules are not
supported. Subpath imports are not available unless they are explicitly added to
`package.json` in a future release.

### Entities

- `User`, `UserId`, `CreateUserInput`, `createUser`, `createUserId`
- `Identity`, `IdentityId`, `IdentityProvider`, `IdentitySubject`, `CreateIdentityInput`, `createIdentity`, `createIdentityId`, `createIdentityProvider`, `createIdentitySubject`
- `Session`, `SessionId`, `CreateSessionInput`, `createSession`, `createSessionId`

Entities validate identifiers and timestamps, expose defensive `Date` snapshots,
and stay independent from persistence or transport concerns.

### Ports

- `AuthStore`, `AuthStoreResult`, `AuthStoreError`, `AuthStoreErrorCode`, `AuthStoreIdentityLookup`, `AuthStoreSessionRecord`
- `Clock`
- `IdGenerator`, `IdGeneratorResult`, `IdGeneratorError`, `IdGeneratorErrorCode`
- `TokenHash`, `TokenHasher`, `TokenHasherResult`, `TokenHasherError`, `TokenHasherErrorCode`, `TokenVerificationInput`

Ports describe the dependencies needed by the use cases. They do not provide
production implementations for databases, clocks, ID generation, token hashing,
or external services.

### Use Cases

- `signInWithIdentity`, `SignInWithIdentityInput`, `SignInWithIdentityDependencies`, `SignInWithIdentityOutput`, `SignInWithIdentityResult`, `SignInWithIdentityError`, `SignInWithIdentityErrorCode`
- `getSession`, `GetSessionInput`, `GetSessionDependencies`, `GetSessionOutput`, `GetSessionResult`, `GetSessionError`, `GetSessionErrorCode`
- `revokeSession`, `RevokeSessionInput`, `RevokeSessionDependencies`, `RevokeSessionOutput`, `RevokeSessionResult`, `RevokeSessionError`, `RevokeSessionErrorCode`

The current use cases sign in with an already verified identity, load an active
session by token, and revoke an active session by token. Provider-specific
verification, request parsing, cookies, and response handling are adapter
responsibilities outside this package.

### Testing Kit

- `InMemoryAuthStore`, `InMemoryAuthStoreSeed`
- `FixedClock`
- `SequentialIdGenerator`
- `DeterministicTokenHasher`
- `createInMemoryTestingKit`, `InMemoryTestingKit`, `InMemoryTestingKitOptions`

The in-memory testing kit is for unit tests, examples, and development fixtures.
It is deterministic by design, exposes in-memory arrays for inspection, and uses
predictable token hashes. It is not a production storage adapter or token hashing
implementation.

## Example

```ts
import {
  createInMemoryTestingKit,
  getSession,
  revokeSession,
  signInWithIdentity,
} from "@authmodules/core";

const kit = createInMemoryTestingKit({
  now: new Date("2026-01-01T00:00:00.000Z"),
});

const signInResult = await signInWithIdentity(
  {
    provider: "email",
    subject: "user@example.com",
    sessionDurationMs: 60 * 60 * 1000,
  },
  kit,
);

if (!signInResult.ok) {
  throw new Error(signInResult.error.message);
}

const sessionToken = signInResult.value.sessionToken;

const sessionResult = await getSession({ sessionToken }, kit);

if (!sessionResult.ok) {
  throw new Error(sessionResult.error.message);
}

const revokeResult = await revokeSession({ sessionToken }, kit);

if (!revokeResult.ok) {
  throw new Error(revokeResult.error.message);
}
```

This example uses the testing kit so it can run without external dependencies.
Production applications should provide their own implementations for the public
ports.

## Headless Boundary

`@authmodules/core` does not contain:

- HTTP handlers, request parsing, or response helpers;
- cookies or session transport logic;
- framework adapters;
- database or production storage adapters;
- UI;
- OAuth provider SDKs, email delivery, password login, or OTP delivery;
- deployment, hosting, or release automation.

Those concerns belong in future adapter, provider, application, or workflow
packages when they are tracked by focused issues.

## Development

Install dependencies with npm:

```sh
npm ci
```

Available local checks:

```sh
npm run check
npm pack --dry-run
```

`npm run check` runs format checking, linting, type checking, tests, build, and
the package dry run. `npm pack --dry-run` can also be run directly when checking
the package contents.

## Status

`@authmodules/core` is currently a focused 0.1.0 baseline. It documents and
exports the implemented headless core surface only. It does not claim production
readiness, release automation, adapter availability, persistence guarantees, or
service-level guarantees.
