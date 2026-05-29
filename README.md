# AuthModules Core

AuthModules Core is the headless identity orchestration core for TypeScript apps.
It is the framework-agnostic package that will hold stable domain contracts for
the `@authmodules/*` package family.

This package is the first minimal baseline for `@authmodules/core` 0.1.0. It
currently exposes the root package marker and initial headless domain entities
while ports and use cases are added through focused follow-up issues.

## Public API

The public API is the root package entrypoint:

```ts
import {
  AUTHMODULES_CORE_PACKAGE,
  createIdentity,
  createSession,
  createUser,
} from "@authmodules/core";
```

Current public exports:

- `AUTHMODULES_CORE_PACKAGE`
- `User`, `UserId`, `CreateUserInput`, `createUser`, `createUserId`
- `Identity`, `IdentityId`, `IdentityProvider`, `IdentitySubject`, `CreateIdentityInput`, `createIdentity`, `createIdentityId`, `createIdentityProvider`, `createIdentitySubject`
- `Session`, `SessionId`, `CreateSessionInput`, `createSession`, `createSessionId`
- `Clock`
- `IdGenerator`, `IdGeneratorResult`, `IdGeneratorError`, `IdGeneratorErrorCode`
- `TokenHash`, `TokenHasher`, `TokenHasherResult`, `TokenHasherError`, `TokenHasherErrorCode`, `TokenVerificationInput`
- `AuthStore`, `AuthStoreResult`, `AuthStoreError`, `AuthStoreErrorCode`, `AuthStoreIdentityLookup`, `AuthStoreSessionRecord`
- `signInWithIdentity`, `SignInWithIdentityInput`, `SignInWithIdentityDependencies`, `SignInWithIdentityOutput`, `SignInWithIdentityResult`, `SignInWithIdentityError`, `SignInWithIdentityErrorCode`

Only symbols exported from `src/index.ts` and exposed through the package root
export are public. Deep imports from `src`, `dist`, or any internal module are
unsupported. Subpath imports are not available unless they are explicitly added
to `package.json` in a future release.

## Core Boundary

Core is reserved for headless contracts:

- domain entities and domain types;
- framework-agnostic ports;
- deterministic use cases;
- public error types;
- focused testing helpers when they are explicitly added to the public API.

Core does not contain runtime adapters, storage adapters, HTTP framework
integrations, cookies, email delivery, OAuth provider SDKs, UI, deployment, or
infrastructure logic.

## Stability

`@authmodules/core` follows the package export map as the public boundary. During
the 0.x series, patch releases should preserve existing public exports, while
minor releases may refine the API before 1.0. Consumers should import only from
`@authmodules/core` to stay inside the supported surface.

## Runtime Baseline

`@authmodules/core` requires Node.js 24 or newer and is published as an ESM
package.
