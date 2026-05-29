import type { Session } from "../entities/session.js";
import type { AuthStore, AuthStoreError } from "../ports/auth-store.js";
import type { Clock } from "../ports/clock.js";
import type { TokenHasher, TokenHasherError } from "../ports/token-hasher.js";

export type GetSessionErrorCode =
  | "INVALID_SESSION_TOKEN"
  | "TOKEN_HASHING_FAILED"
  | "STORE_UNAVAILABLE"
  | "SESSION_NOT_FOUND"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED";

export interface GetSessionError {
  readonly code: GetSessionErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export interface GetSessionInput {
  readonly sessionToken: string;
}

export interface GetSessionDependencies {
  readonly store: AuthStore;
  readonly clock: Clock;
  readonly tokenHasher: TokenHasher;
}

export interface GetSessionOutput {
  readonly session: Session;
}

type GetSessionFailure = {
  readonly ok: false;
  readonly error: GetSessionError;
};

export type GetSessionResult =
  | {
      readonly ok: true;
      readonly value: GetSessionOutput;
    }
  | GetSessionFailure;

export async function getSession(
  input: GetSessionInput,
  dependencies: GetSessionDependencies,
): Promise<GetSessionResult> {
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
    return failure("SESSION_REVOKED", "Session has been revoked.");
  }

  if (session.expiresAt.getTime() <= dependencies.clock.now().getTime()) {
    return failure("SESSION_EXPIRED", "Session has expired.");
  }

  return {
    ok: true,
    value: {
      session,
    },
  };
}

function storeFailure(error: AuthStoreError): GetSessionFailure {
  return failure("STORE_UNAVAILABLE", error.message, error);
}

function tokenFailure(error: TokenHasherError): GetSessionFailure {
  if (error.code === "INVALID_TOKEN") {
    return failure("INVALID_SESSION_TOKEN", error.message, error);
  }

  return failure("TOKEN_HASHING_FAILED", error.message, error);
}

function failure(code: GetSessionErrorCode, message: string, cause?: unknown): GetSessionFailure {
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
