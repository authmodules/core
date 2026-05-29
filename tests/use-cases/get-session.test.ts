import { describe, expect, it } from "vitest";

import {
  createSession,
  getSession,
  type AuthStore,
  type AuthStoreError,
  type AuthStoreResult,
  type AuthStoreSessionRecord,
  type Clock,
  type Identity,
  type Session,
  type SessionId,
  type TokenHash,
  type TokenHasher,
  type TokenHasherResult,
  type User,
  type UserId,
} from "../../src/index.js";

describe("getSession", () => {
  it("returns an active session by session token", async () => {
    const session = createTestSession();
    const store = new RecordingAuthStore({
      sessions: [
        {
          session,
          tokenHash: "hash_token_1" as TokenHash,
        },
      ],
    });

    const result = await getSession(
      {
        sessionToken: "token_1",
      },
      createDependencies(store),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        session,
      },
    });
  });

  it("returns a missing session outcome when no stored token hash matches", async () => {
    const result = await getSession(
      {
        sessionToken: "missing",
      },
      createDependencies(new RecordingAuthStore()),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SESSION_NOT_FOUND",
        message: "Session was not found.",
      },
    });
  });

  it("returns an expired session outcome", async () => {
    const session = createTestSession({
      expiresAt: new Date("2026-01-01T00:15:00.000Z"),
    });
    const store = new RecordingAuthStore({
      sessions: [
        {
          session,
          tokenHash: "hash_token_1" as TokenHash,
        },
      ],
    });

    const result = await getSession(
      {
        sessionToken: "token_1",
      },
      createDependencies(store),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SESSION_EXPIRED",
        message: "Session has expired.",
      },
    });
  });

  it("returns a revoked session outcome", async () => {
    const session = createTestSession({
      revokedAt: new Date("2026-01-01T00:30:00.000Z"),
    });
    const store = new RecordingAuthStore({
      sessions: [
        {
          session,
          tokenHash: "hash_token_1" as TokenHash,
        },
      ],
    });

    const result = await getSession(
      {
        sessionToken: "token_1",
      },
      createDependencies(store),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SESSION_REVOKED",
        message: "Session has been revoked.",
      },
    });
  });

  it("maps invalid token hashing failures to session token errors", async () => {
    const result = await getSession(
      {
        sessionToken: " ",
      },
      {
        ...createDependencies(new RecordingAuthStore()),
        tokenHasher: failingTokenHasher({
          code: "INVALID_TOKEN",
          message: "Session token is invalid.",
        }),
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_SESSION_TOKEN",
        message: "Session token is invalid.",
        cause: {
          code: "INVALID_TOKEN",
          message: "Session token is invalid.",
        },
      },
    });
  });

  it("maps store failures to unavailable outcomes", async () => {
    const result = await getSession(
      {
        sessionToken: "token_1",
      },
      createDependencies(
        new RecordingAuthStore({
          findSessionError: {
            code: "UNAVAILABLE",
            message: "Store is unavailable.",
          },
        }),
      ),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "STORE_UNAVAILABLE",
        message: "Store is unavailable.",
        cause: {
          code: "UNAVAILABLE",
          message: "Store is unavailable.",
        },
      },
    });
  });
});

interface StoreOptions {
  readonly sessions?: readonly AuthStoreSessionRecord[];
  readonly findSessionError?: AuthStoreError;
}

class RecordingAuthStore implements AuthStore {
  readonly sessions: AuthStoreSessionRecord[];
  private readonly findSessionError: AuthStoreError | undefined;

  constructor(options: StoreOptions = {}) {
    this.sessions = [...(options.sessions ?? [])];
    this.findSessionError = options.findSessionError;
  }

  async findUserById(): Promise<AuthStoreResult<User | null>> {
    return success(null);
  }

  async saveUser(): Promise<AuthStoreResult<void>> {
    return success(undefined);
  }

  async findIdentityByProviderAndSubject(): Promise<AuthStoreResult<Identity | null>> {
    return success(null);
  }

  async saveIdentity(): Promise<AuthStoreResult<void>> {
    return success(undefined);
  }

  async findSessionById(sessionId: SessionId): Promise<AuthStoreResult<Session | null>> {
    return success(
      this.sessions.find((record) => record.session.id === sessionId)?.session ?? null,
    );
  }

  async findSessionByTokenHash(tokenHash: TokenHash): Promise<AuthStoreResult<Session | null>> {
    if (this.findSessionError !== undefined) {
      return {
        ok: false,
        error: this.findSessionError,
      };
    }

    return success(this.sessions.find((record) => record.tokenHash === tokenHash)?.session ?? null);
  }

  async saveSession(record: AuthStoreSessionRecord): Promise<AuthStoreResult<void>> {
    this.sessions.push(record);
    return success(undefined);
  }

  async updateSession(session: Session): Promise<AuthStoreResult<void>> {
    const index = this.sessions.findIndex((record) => record.session.id === session.id);

    if (index >= 0) {
      const existingRecord = this.sessions[index];

      if (existingRecord === undefined) {
        return success(undefined);
      }

      this.sessions[index] = {
        ...existingRecord,
        session,
      };
    }

    return success(undefined);
  }
}

function createDependencies(store: AuthStore): {
  readonly store: AuthStore;
  readonly clock: Clock;
  readonly tokenHasher: TokenHasher;
} {
  return {
    store,
    clock: fixedClock(new Date("2026-01-01T00:30:00.000Z")),
    tokenHasher: {
      async hashToken(token: string): Promise<TokenHasherResult<TokenHash>> {
        return success(`hash_${token}` as TokenHash);
      },
      async verifyToken(): Promise<TokenHasherResult<boolean>> {
        return success(true);
      },
    },
  };
}

function createTestSession(
  overrides: {
    readonly expiresAt?: Date;
    readonly revokedAt?: Date | null;
  } = {},
): Session {
  const input = {
    id: "session_1",
    userId: "user_1" as UserId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: overrides.expiresAt ?? new Date("2026-01-01T01:00:00.000Z"),
    ...(overrides.revokedAt !== undefined ? { revokedAt: overrides.revokedAt } : {}),
  };

  return createSession(input);
}

function fixedClock(now: Date): Clock {
  return {
    now() {
      return new Date(now.getTime());
    },
  };
}

function failingTokenHasher(error: {
  readonly code: "INVALID_TOKEN" | "UNAVAILABLE";
  readonly message: string;
}): TokenHasher {
  return {
    async hashToken(): Promise<TokenHasherResult<TokenHash>> {
      return {
        ok: false,
        error,
      };
    },
    async verifyToken(): Promise<TokenHasherResult<boolean>> {
      return success(false);
    },
  };
}

function success<Value>(value: Value): {
  readonly ok: true;
  readonly value: Value;
} {
  return {
    ok: true,
    value,
  };
}
