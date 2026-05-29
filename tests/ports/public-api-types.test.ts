import { describe, expectTypeOf, it } from "vitest";

import type {
  AuthStore,
  AuthStoreResult,
  Clock,
  GetSessionDependencies,
  GetSessionInput,
  GetSessionResult,
  IdGenerator,
  IdGeneratorResult,
  Identity,
  IdentityProvider,
  IdentitySubject,
  Session,
  SessionId,
  SignInWithIdentityDependencies,
  SignInWithIdentityInput,
  SignInWithIdentityResult,
  TokenHash,
  TokenHasher,
  TokenHasherResult,
  User,
  UserId,
} from "../../src/index.js";

describe("@authmodules/core port contracts", () => {
  it("exposes a clock for deterministic time access", () => {
    expectTypeOf<Clock>().toMatchTypeOf<{
      now(): Date;
    }>();
  });

  it("exposes ID generation for branded entity IDs", () => {
    expectTypeOf<IdGenerator<UserId>["generateId"]>().returns.resolves.toEqualTypeOf<
      IdGeneratorResult<UserId>
    >();
    expectTypeOf<IdGenerator<SessionId>["generateId"]>().returns.resolves.toEqualTypeOf<
      IdGeneratorResult<SessionId>
    >();
  });

  it("exposes token hashing without a crypto implementation", () => {
    expectTypeOf<TokenHasher["hashToken"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<TokenHasher["hashToken"]>().returns.resolves.toEqualTypeOf<
      TokenHasherResult<TokenHash>
    >();
    expectTypeOf<TokenHasher["verifyToken"]>().returns.resolves.toEqualTypeOf<
      TokenHasherResult<boolean>
    >();
  });

  it("exposes storage operations for current domain entities", () => {
    expectTypeOf<AuthStore["findUserById"]>().parameter(0).toEqualTypeOf<UserId>();
    expectTypeOf<AuthStore["findUserById"]>().returns.resolves.toEqualTypeOf<
      AuthStoreResult<User | null>
    >();
    expectTypeOf<AuthStore["findIdentityByProviderAndSubject"]>().parameter(0).toEqualTypeOf<{
      readonly provider: IdentityProvider;
      readonly subject: IdentitySubject;
    }>();
    expectTypeOf<AuthStore["findIdentityByProviderAndSubject"]>().returns.resolves.toEqualTypeOf<
      AuthStoreResult<Identity | null>
    >();
    expectTypeOf<AuthStore["findSessionByTokenHash"]>().parameter(0).toEqualTypeOf<TokenHash>();
    expectTypeOf<AuthStore["findSessionByTokenHash"]>().returns.resolves.toEqualTypeOf<
      AuthStoreResult<Session | null>
    >();
  });

  it("exposes the getSession use case contract", () => {
    expectTypeOf<GetSessionInput>().toEqualTypeOf<{
      readonly sessionToken: string;
    }>();
    expectTypeOf<GetSessionDependencies>().toEqualTypeOf<{
      readonly store: AuthStore;
      readonly clock: Clock;
      readonly tokenHasher: TokenHasher;
    }>();
    expectTypeOf<GetSessionResult>().toMatchTypeOf<
      | {
          readonly ok: true;
          readonly value: {
            readonly session: Session;
          };
        }
      | {
          readonly ok: false;
          readonly error: {
            readonly code: string;
            readonly message: string;
            readonly cause?: unknown;
          };
        }
    >();
  });

  it("exposes the signInWithIdentity use case contract", () => {
    expectTypeOf<SignInWithIdentityInput>().toEqualTypeOf<{
      readonly provider: string;
      readonly subject: string;
      readonly sessionDurationMs: number;
    }>();
    expectTypeOf<SignInWithIdentityDependencies>().toMatchTypeOf<{
      readonly store: AuthStore;
      readonly clock: Clock;
      readonly userIdGenerator: IdGenerator<UserId>;
      readonly identityIdGenerator: IdGenerator<Identity["id"]>;
      readonly sessionIdGenerator: IdGenerator<SessionId>;
      readonly sessionTokenGenerator: IdGenerator<string>;
      readonly tokenHasher: TokenHasher;
    }>();
    expectTypeOf<SignInWithIdentityResult>().toMatchTypeOf<
      | {
          readonly ok: true;
          readonly value: {
            readonly user: User;
            readonly identity: Identity;
            readonly session: Session;
            readonly sessionToken: string;
          };
        }
      | {
          readonly ok: false;
          readonly error: {
            readonly code: string;
            readonly message: string;
            readonly cause?: unknown;
          };
        }
    >();
  });
});
