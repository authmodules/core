import { createSession } from "../entities/session.js";
import type { Session } from "../entities/session.js";
import type { AuthStore, AuthStoreError } from "../ports/auth-store.js";
import type { Clock } from "../ports/clock.js";
import type { TokenHasher, TokenHasherError } from "../ports/token-hasher.js";

export type RevokeSessionErrorCode =
  | "INVALID_SESSION_TOKEN"
  | "TOKEN_HASHING_FAILED"
  | "STORE_UNAVAILABLE"
  | "SESSION_NOT_FOUND"
  | "SESSION_EXPIRED"
  | "SESSION_ALREADY_REVOKED";

export interface RevokeSessionError {
  readonly code: RevokeSessionErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export interface RevokeSessionInput {
  readonly sessionToken: string;
}

export interface RevokeSessionDependencies {
  readonly store: AuthStore;
  readonly clock: Clock;
  readonly tokenHasher: TokenHasher;
}

export interface RevokeSessionOutput {
  readonly session: Session;
}

type RevokeSessionFailure = {
  readonly ok: false;
  readonly error: RevokeSessionError;
};

export type RevokeSessionResult =
  | {
      readonly ok: true;
      readonly value: RevokeSessionOutput;
    }
  | RevokeSessionFailure;

export async function revokeSession(
  input: RevokeSessionInput,
  dependencies: RevokeSessionDependencies,
): Promise<RevokeSessionResult> {
  if (input.sessionToken.trim().length === 0) {
    return failure("INVALID_SESSION_TOKEN", "Session token must be a non-empty string.");
  }

  const tokenHashResult = await dependencies.tokenHasher.hashToken(input.sessionToken);

  if (!tokenHashResult.ok) {
    return tokenFailure(tokenHashResult.error);
  }

  const sessionResult = await dependencies.store.findSessionByTokenHash(tokenHashResult.value);

  if (!sessionResult.ok) {
    return storeFailure(sessionResult.error);
  }

  if (sessionResult.value === null) {
    return failure("SESSION_NOT_FOUND", "Session was not found.");
  }

  const session = sessionResult.value;

  if (session.revokedAt !== null) {
    return failure("SESSION_ALREADY_REVOKED", "Session has already been revoked.");
  }

  const now = dependencies.clock.now();

  if (session.expiresAt.getTime() <= now.getTime()) {
    return failure("SESSION_EXPIRED", "Session has expired.");
  }

  let revokedSession: Session;

  try {
    revokedSession = createSession({
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      updatedAt: now,
      expiresAt: session.expiresAt,
      revokedAt: now,
    });
  } catch (cause) {
    return failure("STORE_UNAVAILABLE", "Session could not be revoked.", cause);
  }

  const updateResult = await dependencies.store.updateSession(revokedSession);

  if (!updateResult.ok) {
    return storeFailure(updateResult.error);
  }

  return {
    ok: true,
    value: {
      session: revokedSession,
    },
  };
}

function storeFailure(error: AuthStoreError): RevokeSessionFailure {
  return failure("STORE_UNAVAILABLE", error.message, error);
}

function tokenFailure(error: TokenHasherError): RevokeSessionFailure {
  if (error.code === "INVALID_TOKEN") {
    return failure("INVALID_SESSION_TOKEN", error.message, error);
  }

  return failure("TOKEN_HASHING_FAILED", error.message, error);
}

function failure(
  code: RevokeSessionErrorCode,
  message: string,
  cause?: unknown,
): RevokeSessionFailure {
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
