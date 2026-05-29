import {
  createIdentity,
  createIdentityProvider,
  createIdentitySubject,
} from "../entities/identity.js";
import type { Identity, IdentityId } from "../entities/identity.js";
import { createSession } from "../entities/session.js";
import type { Session, SessionId } from "../entities/session.js";
import { createUser } from "../entities/user.js";
import type { User, UserId } from "../entities/user.js";
import type { AuthStore, AuthStoreError } from "../ports/auth-store.js";
import type { Clock } from "../ports/clock.js";
import type { IdGenerator, IdGeneratorError } from "../ports/id-generator.js";
import type { TokenHasher, TokenHasherError } from "../ports/token-hasher.js";

export type SignInWithIdentityErrorCode =
  | "INVALID_INPUT"
  | "ID_GENERATION_FAILED"
  | "TOKEN_HASHING_FAILED"
  | "STORE_CONFLICT"
  | "STORE_UNAVAILABLE";

export interface SignInWithIdentityError {
  readonly code: SignInWithIdentityErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export interface SignInWithIdentityInput {
  readonly provider: string;
  readonly subject: string;
  readonly sessionDurationMs: number;
}

export interface SignInWithIdentityDependencies {
  readonly store: AuthStore;
  readonly clock: Clock;
  readonly userIdGenerator: IdGenerator<UserId>;
  readonly identityIdGenerator: IdGenerator<IdentityId>;
  readonly sessionIdGenerator: IdGenerator<SessionId>;
  readonly sessionTokenGenerator: IdGenerator<string>;
  readonly tokenHasher: TokenHasher;
}

export interface SignInWithIdentityOutput {
  readonly user: User;
  readonly identity: Identity;
  readonly session: Session;
  readonly sessionToken: string;
}

type SignInWithIdentityFailure = {
  readonly ok: false;
  readonly error: SignInWithIdentityError;
};

export type SignInWithIdentityResult =
  | {
      readonly ok: true;
      readonly value: SignInWithIdentityOutput;
    }
  | SignInWithIdentityFailure;

export async function signInWithIdentity(
  input: SignInWithIdentityInput,
  dependencies: SignInWithIdentityDependencies,
): Promise<SignInWithIdentityResult> {
  if (!Number.isSafeInteger(input.sessionDurationMs) || input.sessionDurationMs <= 0) {
    return failure("INVALID_INPUT", "Session duration must be a positive safe integer.");
  }

  const now = dependencies.clock.now();
  const expiresAt = new Date(now.getTime() + input.sessionDurationMs);

  if (!Number.isFinite(expiresAt.getTime())) {
    return failure("INVALID_INPUT", "Session expiration must be a valid date.");
  }

  const providerResult = createIdentityLookup(input);

  if (!providerResult.ok) {
    return providerResult;
  }

  const identityResult = await dependencies.store.findIdentityByProviderAndSubject(
    providerResult.value,
  );

  if (!identityResult.ok) {
    return storeFailure(identityResult.error);
  }

  const sessionIdResult = await dependencies.sessionIdGenerator.generateId();

  if (!sessionIdResult.ok) {
    return idFailure(sessionIdResult.error);
  }

  const sessionTokenResult = await dependencies.sessionTokenGenerator.generateId();

  if (!sessionTokenResult.ok) {
    return idFailure(sessionTokenResult.error);
  }

  if (sessionTokenResult.value.trim().length === 0) {
    return idFailure({
      code: "UNAVAILABLE",
      message: "Generated session token must be a non-empty string.",
    });
  }

  const tokenHashResult = await dependencies.tokenHasher.hashToken(sessionTokenResult.value);

  if (!tokenHashResult.ok) {
    return tokenFailure(tokenHashResult.error);
  }

  const principalResult =
    identityResult.value === null
      ? await createNewPrincipal(providerResult.value, now, dependencies)
      : await findExistingPrincipal(identityResult.value, dependencies);

  if (!principalResult.ok) {
    return principalResult;
  }

  let session: Session;

  try {
    session = createSession({
      id: sessionIdResult.value,
      userId: principalResult.value.user.id,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });
  } catch (cause) {
    return idFailure({
      code: "UNAVAILABLE",
      message: "Generated session data was invalid.",
      cause,
    });
  }

  const saveSessionResult = await dependencies.store.saveSession({
    session,
    tokenHash: tokenHashResult.value,
  });

  if (!saveSessionResult.ok) {
    return storeFailure(saveSessionResult.error);
  }

  return {
    ok: true,
    value: {
      user: principalResult.value.user,
      identity: principalResult.value.identity,
      session,
      sessionToken: sessionTokenResult.value,
    },
  };
}

interface Principal {
  readonly user: User;
  readonly identity: Identity;
}

type PrincipalResult =
  | {
      readonly ok: true;
      readonly value: Principal;
    }
  | SignInWithIdentityFailure;

async function createNewPrincipal(
  lookup: {
    readonly provider: Identity["provider"];
    readonly subject: Identity["subject"];
  },
  now: Date,
  dependencies: SignInWithIdentityDependencies,
): Promise<PrincipalResult> {
  const userIdResult = await dependencies.userIdGenerator.generateId();

  if (!userIdResult.ok) {
    return idFailure(userIdResult.error);
  }

  const identityIdResult = await dependencies.identityIdGenerator.generateId();

  if (!identityIdResult.ok) {
    return idFailure(identityIdResult.error);
  }

  let user: User;
  let identity: Identity;

  try {
    user = createUser({
      id: userIdResult.value,
      createdAt: now,
      updatedAt: now,
    });
    identity = createIdentity({
      id: identityIdResult.value,
      userId: user.id,
      provider: lookup.provider,
      subject: lookup.subject,
      createdAt: now,
      updatedAt: now,
    });
  } catch (cause) {
    return idFailure({
      code: "UNAVAILABLE",
      message: "Generated principal data was invalid.",
      cause,
    });
  }

  const saveUserResult = await dependencies.store.saveUser(user);

  if (!saveUserResult.ok) {
    return storeFailure(saveUserResult.error);
  }

  const saveIdentityResult = await dependencies.store.saveIdentity(identity);

  if (!saveIdentityResult.ok) {
    if (saveIdentityResult.error.code === "CONFLICT") {
      return findPrincipalByLookup(lookup, dependencies);
    }

    return storeFailure(saveIdentityResult.error);
  }

  return {
    ok: true,
    value: {
      user,
      identity,
    },
  };
}

async function findExistingPrincipal(
  identity: Identity,
  dependencies: SignInWithIdentityDependencies,
): Promise<PrincipalResult> {
  const userResult = await dependencies.store.findUserById(identity.userId);

  if (!userResult.ok) {
    return storeFailure(userResult.error);
  }

  if (userResult.value === null) {
    return failure("STORE_UNAVAILABLE", "Identity user was not found.");
  }

  return {
    ok: true,
    value: {
      user: userResult.value,
      identity,
    },
  };
}

async function findPrincipalByLookup(
  lookup: {
    readonly provider: Identity["provider"];
    readonly subject: Identity["subject"];
  },
  dependencies: SignInWithIdentityDependencies,
): Promise<PrincipalResult> {
  const identityResult = await dependencies.store.findIdentityByProviderAndSubject(lookup);

  if (!identityResult.ok) {
    return storeFailure(identityResult.error);
  }

  if (identityResult.value === null) {
    return failure("STORE_CONFLICT", "Identity was not found after a store conflict.");
  }

  return findExistingPrincipal(identityResult.value, dependencies);
}

function createIdentityLookup(input: SignInWithIdentityInput):
  | {
      readonly ok: true;
      readonly value: {
        readonly provider: Identity["provider"];
        readonly subject: Identity["subject"];
      };
    }
  | {
      readonly ok: false;
      readonly error: SignInWithIdentityError;
    } {
  try {
    return {
      ok: true,
      value: {
        provider: createIdentityProvider(input.provider),
        subject: createIdentitySubject(input.subject),
      },
    };
  } catch (cause) {
    return failure(
      "INVALID_INPUT",
      "Identity provider and subject must be non-empty strings.",
      cause,
    );
  }
}

function storeFailure(error: AuthStoreError): SignInWithIdentityFailure {
  return failure(
    error.code === "CONFLICT" ? "STORE_CONFLICT" : "STORE_UNAVAILABLE",
    error.message,
    error,
  );
}

function idFailure(error: IdGeneratorError): SignInWithIdentityFailure {
  return failure("ID_GENERATION_FAILED", error.message, error);
}

function tokenFailure(error: TokenHasherError): SignInWithIdentityFailure {
  return failure("TOKEN_HASHING_FAILED", error.message, error);
}

function failure(
  code: SignInWithIdentityErrorCode,
  message: string,
  cause?: unknown,
): SignInWithIdentityFailure {
  if (cause === undefined) {
    return {
      ok: false,
      error: {
        code,
        message,
      },
    };
  }

  return {
    ok: false,
    error: {
      code,
      message,
      cause,
    },
  };
}
