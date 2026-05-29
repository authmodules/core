# AuthModules Core

`@authmodules/core` is a headless TypeScript package for authentication domain
entities, ports, use cases, and test helpers. It provides the current core
contracts for the AuthModules 0.1.0 baseline without choosing an HTTP framework,
storage backend, provider SDK, UI, or deployment model.

The package is intentionally small. It is useful for building and testing auth
flows around current domain boundaries, while runtime adapters and production
integration packages remain outside this repository.

## Installation

`@authmodules/core` is published to the GitHub Packages npm registry. Consumers
must configure the `@authmodules` scope before installing:

```sh
npm config set @authmodules:registry https://npm.pkg.github.com
```

Consumers must also authenticate to GitHub Packages before installing. The token
must have access to the package and should be configured outside the repository,
for example in a user-level npm configuration:

```text
@authmodules:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Do not commit real GitHub tokens or `.npmrc` files that contain credentials.

After the package is available from GitHub Packages:

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

## Release Preparation

The `@authmodules/core@0.1.0` release is prepared manually after the release
pull request has been reviewed, merged, and verified on `main`. The repository
does not currently publish from GitHub Actions.

Prerequisites:

- Node.js 24 or newer;
- npm;
- npm authentication for `npm.pkg.github.com`;
- a GitHub token with package publishing permissions for the `authmodules`
  organization;
- a clean local checkout of `main` at the commit intended for release.

Do not paste tokens into issues, pull requests, chat, docs, shell history, or
committed files. Local authentication should be configured outside the
repository. If a local `.npmrc` is used, it must not be committed with a real
token.

The package metadata targets the GitHub Packages npm registry through
`publishConfig.registry`:

```text
https://npm.pkg.github.com
```

Run the local release checks before tagging or publishing:

```sh
npm ci
npm run check
npm pack --dry-run
```

`npm run check` must pass before publication. It runs formatting checks, linting,
type checking, tests, the package build, and the package dry run. The direct
`npm pack --dry-run` command is kept as an explicit final package contents
review.

The expected package dry run for `0.1.0` should include only the built package
entrypoint, type declarations, source map, package metadata, and this README:

```text
README.md
dist/index.d.ts
dist/index.js
dist/index.js.map
package.json
```

The release tag for the first package release is expected to be `v0.1.0`:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Pushing `v0.1.0` triggers the existing release verification workflow. The
workflow checks out the tagged commit, installs dependencies with `npm ci` on
Node.js 24, runs `npm run check`, and runs `npm pack --dry-run`. It does not
publish the package.

After the tag verification workflow succeeds and the package contents have been
reviewed, publish manually:

```sh
npm publish
```

After the first publish, verify the package visibility and package access
settings in GitHub Packages before announcing the release or asking consumers to
install it. If the package must be publicly consumable, set the package
visibility to public in GitHub Packages. If it must be consumed only by selected
repositories or organization members, grant the required access explicitly.

The release intentionally does not automate npm tokens, trusted publishing,
semantic-release, Changesets, changelog generation, release notes generation, or
adapter package publication yet.

## Status

`@authmodules/core` is currently a focused 0.1.0 baseline. It documents and
exports the implemented headless core surface only. It does not claim production
readiness, release automation, adapter availability, persistence guarantees, or
service-level guarantees.
