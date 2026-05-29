import { describe, expect, it } from "vitest";

import {
  createSession,
  revokeSession,
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

describe("revokeSession", () => {
  it("revokes an active session by session token", async () => {
    const session = createTestSession();
    const store = new RecordingAuthStore({
      sessions: [
        {
          session,
          tokenHash: "hash_token_1" as TokenHash,
        },
      ],
    });

    const result = await revokeSession(
      {
        sessionToken: "token_1",
      },
      createDependencies(store),
    );

    const expectedSession = createTestSession({
      updatedAt: new Date("2026-01-01T00:30:00.000Z"),
      revokedAt: new Date("2026-01-01T00:30:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        session: expectedSession,
      },
    });
    expect(store.updateSessionCalls).toEqual([expectedSession]);
    expect(store.sessions[0]?.session).toEqual(expectedSession);
  });

  it("returns a missing session outcome when no stored token hash matches", async () => {
    const store = new RecordingAuthStore();

    const result = await revokeSession(
      {
        sessionToken: "missing",
      },
      createDependencies(store),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SESSION_NOT_FOUND",
        message: "Session was not found.",
      },
    });
    expect(store.updateSessionCalls).toEqual([]);
  });

  it("returns an already revoked session outcome without updating the session", async () => {
    const session = createTestSession({
      revokedAt: new Date("2026-01-01T00:15:00.000Z"),
    });
    const store = new RecordingAuthStore({
      sessions: [
        {
          session,
          tokenHash: "hash_token_1" as TokenHash,
        },
      ],
    });

    const result = await revokeSession(
      {
        sessionToken: "token_1",
      },
      createDependencies(store),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SESSION_ALREADY_REVOKED",
        message: "Session has already been revoked.",
      },
    });
    expect(store.updateSessionCalls).toEqual([]);
  });

  it("returns an expired session outcome without updating the session", async () => {
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

    const result = await revokeSession(
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
    expect(store.updateSessionCalls).toEqual([]);
  });

  it("rejects blank session tokens before hashing", async () => {
    const store = new RecordingAuthStore();
    const tokenHasher = recordingTokenHasher();

    const result = await revokeSession(
      {
        sessionToken: " ",
      },
      {
        ...createDependencies(store),
        tokenHasher,
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_SESSION_TOKEN",
        message: "Session token must be a non-empty string.",
      },
    });
    expect(tokenHasher.hashTokenCalls).toEqual([]);
    expect(store.findSessionByTokenHashCalls).toEqual([]);
  });

  it("maps invalid token hashing failures to session token errors", async () => {
    const result = await revokeSession(
      {
        sessionToken: "malformed",
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

  it("maps store lookup failures to unavailable outcomes", async () => {
    const result = await revokeSession(
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

  it("maps store update failures to unavailable outcomes", async () => {
    const result = await revokeSession(
      {
        sessionToken: "token_1",
      },
      createDependencies(
        new RecordingAuthStore({
          sessions: [
            {
              session: createTestSession(),
              tokenHash: "hash_token_1" as TokenHash,
            },
          ],
          updateSessionError: {
            code: "UNAVAILABLE",
            message: "Store update failed.",
          },
        }),
      ),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "STORE_UNAVAILABLE",
        message: "Store update failed.",
        cause: {
          code: "UNAVAILABLE",
          message: "Store update failed.",
        },
      },
    });
  });
});

interface StoreOptions {
  readonly sessions?: readonly AuthStoreSessionRecord[];
  readonly findSessionError?: AuthStoreError;
  readonly updateSessionError?: AuthStoreError;
}

class RecordingAuthStore implements AuthStore {
  readonly sessions: AuthStoreSessionRecord[];
  readonly findSessionByTokenHashCalls: TokenHash[] = [];
  readonly updateSessionCalls: Session[] = [];
  private readonly findSessionError: AuthStoreError | undefined;
  private readonly updateSessionError: AuthStoreError | undefined;

  constructor(options: StoreOptions = {}) {
    this.sessions = [...(options.sessions ?? [])];
    this.findSessionError = options.findSessionError;
    this.updateSessionError = options.updateSessionError;
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
    this.findSessionByTokenHashCalls.push(tokenHash);

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
    this.updateSessionCalls.push(session);

    if (this.updateSessionError !== undefined) {
      return {
        ok: false,
        error: this.updateSessionError,
      };
    }

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
    tokenHasher: recordingTokenHasher(),
  };
}

function createTestSession(
  overrides: {
    readonly updatedAt?: Date;
    readonly expiresAt?: Date;
    readonly revokedAt?: Date | null;
  } = {},
): Session {
  return createSession({
    id: "session_1",
    userId: "user_1" as UserId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: overrides.expiresAt ?? new Date("2026-01-01T01:00:00.000Z"),
    ...(overrides.revokedAt !== undefined ? { revokedAt: overrides.revokedAt } : {}),
  });
}

function fixedClock(now: Date): Clock {
  return {
    now() {
      return new Date(now.getTime());
    },
  };
}

function recordingTokenHasher(): TokenHasher & {
  readonly hashTokenCalls: string[];
} {
  const hashTokenCalls: string[] = [];

  return {
    hashTokenCalls,
    async hashToken(token: string): Promise<TokenHasherResult<TokenHash>> {
      hashTokenCalls.push(token);
      return success(`hash_${token}` as TokenHash);
    },
    async verifyToken(): Promise<TokenHasherResult<boolean>> {
      return success(true);
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
