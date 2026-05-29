import { describe, expect, it } from "vitest";

import {
  createIdentity,
  createUser,
  signInWithIdentity,
  type AuthStore,
  type AuthStoreError,
  type AuthStoreIdentityLookup,
  type AuthStoreResult,
  type AuthStoreSessionRecord,
  type Clock,
  type IdGenerator,
  type IdGeneratorResult,
  type Identity,
  type Session,
  type SessionId,
  type SignInWithIdentityDependencies,
  type TokenHash,
  type TokenHasher,
  type TokenHasherResult,
  type User,
  type UserId,
} from "../../src/index.js";

describe("signInWithIdentity", () => {
  it("creates a user, identity, and session for a new identity", async () => {
    const store = new RecordingAuthStore();
    const dependencies = createDependencies(store);

    const result = await signInWithIdentity(
      {
        provider: "github",
        subject: "123",
        sessionDurationMs: 3_600_000,
      },
      dependencies,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.value.user).toEqual({
      id: "user_1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(result.value.identity).toEqual({
      id: "identity_1",
      userId: "user_1",
      provider: "github",
      subject: "123",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(result.value.session).toEqual({
      id: "session_1",
      userId: "user_1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-01T01:00:00.000Z"),
      revokedAt: null,
    });
    expect(result.value.sessionToken).toBe("token_1");
    expect(store.users).toHaveLength(1);
    expect(store.identities).toHaveLength(1);
    expect(store.sessions).toEqual([
      {
        session: result.value.session,
        tokenHash: "hash_token_1",
      },
    ]);
  });

  it("creates only a session for an existing identity", async () => {
    const existingUser = createUser({
      id: "user_existing",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const existingIdentity = createIdentity({
      id: "identity_existing",
      userId: existingUser.id,
      provider: "github",
      subject: "123",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const store = new RecordingAuthStore({
      users: [existingUser],
      identities: [existingIdentity],
    });

    const result = await signInWithIdentity(
      {
        provider: "github",
        subject: "123",
        sessionDurationMs: 60_000,
      },
      createDependencies(store),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.value.user).toBe(existingUser);
    expect(result.value.identity).toBe(existingIdentity);
    expect(store.users).toEqual([existingUser]);
    expect(store.identities).toEqual([existingIdentity]);
    expect(store.sessions).toHaveLength(1);
    expect(result.value.session.userId).toBe(existingUser.id);
  });

  it("returns an input error for invalid identity fields", async () => {
    const store = new RecordingAuthStore();

    const result = await signInWithIdentity(
      {
        provider: " ",
        subject: "123",
        sessionDurationMs: 60_000,
      },
      createDependencies(store),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Identity provider and subject must be non-empty strings.",
        cause: expect.any(TypeError),
      },
    });
    expect(store.sessions).toHaveLength(0);
  });

  it("returns an ID generation error before persisting a new principal", async () => {
    const store = new RecordingAuthStore();

    const result = await signInWithIdentity(
      {
        provider: "github",
        subject: "123",
        sessionDurationMs: 60_000,
      },
      {
        ...createDependencies(store),
        userIdGenerator: failingIdGenerator<UserId>(),
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ID_GENERATION_FAILED",
        message: "ID service is unavailable.",
        cause: {
          code: "UNAVAILABLE",
          message: "ID service is unavailable.",
        },
      },
    });
    expect(store.users).toHaveLength(0);
    expect(store.identities).toHaveLength(0);
    expect(store.sessions).toHaveLength(0);
  });

  it("returns a token hashing error before persisting", async () => {
    const store = new RecordingAuthStore();

    const result = await signInWithIdentity(
      {
        provider: "github",
        subject: "123",
        sessionDurationMs: 60_000,
      },
      {
        ...createDependencies(store),
        tokenHasher: failingTokenHasher(),
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "TOKEN_HASHING_FAILED",
        message: "Hash service is unavailable.",
        cause: {
          code: "UNAVAILABLE",
          message: "Hash service is unavailable.",
        },
      },
    });
    expect(store.sessions).toHaveLength(0);
  });

  it("rejects a blank generated session token before hashing", async () => {
    const store = new RecordingAuthStore();

    const result = await signInWithIdentity(
      {
        provider: "github",
        subject: "123",
        sessionDurationMs: 60_000,
      },
      {
        ...createDependencies(store),
        sessionTokenGenerator: fixedIdGenerator(" "),
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ID_GENERATION_FAILED",
        message: "Generated session token must be a non-empty string.",
        cause: {
          code: "UNAVAILABLE",
          message: "Generated session token must be a non-empty string.",
        },
      },
    });
    expect(store.sessions).toHaveLength(0);
  });

  it("continues with the existing principal when saving a new identity conflicts", async () => {
    const existingUser = createUser({
      id: "user_existing",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const existingIdentity = createIdentity({
      id: "identity_existing",
      userId: existingUser.id,
      provider: "github",
      subject: "123",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const store = new RecordingAuthStore({
      users: [existingUser],
      identities: [existingIdentity],
      firstIdentityLookupResult: null,
      saveIdentityError: {
        code: "CONFLICT",
        message: "Identity already exists.",
      },
    });

    const result = await signInWithIdentity(
      {
        provider: "github",
        subject: "123",
        sessionDurationMs: 60_000,
      },
      createDependencies(store),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.value.user).toBe(existingUser);
    expect(result.value.identity).toBe(existingIdentity);
    expect(result.value.session.userId).toBe(existingUser.id);
    expect(store.sessions).toHaveLength(1);
  });

  it("maps store conflicts to use case errors", async () => {
    const store = new RecordingAuthStore({
      saveSessionError: {
        code: "CONFLICT",
        message: "Session already exists.",
      },
    });

    const result = await signInWithIdentity(
      {
        provider: "github",
        subject: "123",
        sessionDurationMs: 60_000,
      },
      createDependencies(store),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "STORE_CONFLICT",
        message: "Session already exists.",
        cause: {
          code: "CONFLICT",
          message: "Session already exists.",
        },
      },
    });
  });
});

interface StoreOptions {
  readonly users?: readonly User[];
  readonly identities?: readonly Identity[];
  readonly firstIdentityLookupResult?: Identity | null;
  readonly saveIdentityError?: AuthStoreError;
  readonly saveSessionError?: AuthStoreError;
}

class RecordingAuthStore implements AuthStore {
  readonly users: User[];
  readonly identities: Identity[];
  readonly sessions: AuthStoreSessionRecord[] = [];
  private identityLookupCount = 0;
  private readonly firstIdentityLookupResult: Identity | null | undefined;
  private readonly saveIdentityError: AuthStoreError | undefined;
  private readonly saveSessionError: AuthStoreError | undefined;

  constructor(options: StoreOptions = {}) {
    this.users = [...(options.users ?? [])];
    this.identities = [...(options.identities ?? [])];
    this.firstIdentityLookupResult = options.firstIdentityLookupResult;
    this.saveIdentityError = options.saveIdentityError;
    this.saveSessionError = options.saveSessionError;
  }

  async findUserById(userId: UserId): Promise<AuthStoreResult<User | null>> {
    return success(this.users.find((user) => user.id === userId) ?? null);
  }

  async saveUser(user: User): Promise<AuthStoreResult<void>> {
    this.users.push(user);
    return success(undefined);
  }

  async findIdentityByProviderAndSubject(
    lookup: AuthStoreIdentityLookup,
  ): Promise<AuthStoreResult<Identity | null>> {
    this.identityLookupCount += 1;

    if (this.identityLookupCount === 1 && this.firstIdentityLookupResult !== undefined) {
      return success(this.firstIdentityLookupResult);
    }

    return success(
      this.identities.find(
        (identity) => identity.provider === lookup.provider && identity.subject === lookup.subject,
      ) ?? null,
    );
  }

  async saveIdentity(identity: Identity): Promise<AuthStoreResult<void>> {
    if (this.saveIdentityError !== undefined) {
      return {
        ok: false,
        error: this.saveIdentityError,
      };
    }

    this.identities.push(identity);
    return success(undefined);
  }

  async findSessionById(sessionId: SessionId): Promise<AuthStoreResult<Session | null>> {
    return success(
      this.sessions.find((record) => record.session.id === sessionId)?.session ?? null,
    );
  }

  async findSessionByTokenHash(tokenHash: TokenHash): Promise<AuthStoreResult<Session | null>> {
    return success(this.sessions.find((record) => record.tokenHash === tokenHash)?.session ?? null);
  }

  async saveSession(record: AuthStoreSessionRecord): Promise<AuthStoreResult<void>> {
    if (this.saveSessionError !== undefined) {
      return {
        ok: false,
        error: this.saveSessionError,
      };
    }

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

function createDependencies(store: AuthStore): SignInWithIdentityDependencies {
  return {
    store,
    clock: fixedClock(new Date("2026-01-01T00:00:00.000Z")),
    userIdGenerator: fixedIdGenerator("user_1" as UserId),
    identityIdGenerator: fixedIdGenerator("identity_1" as Identity["id"]),
    sessionIdGenerator: fixedIdGenerator("session_1" as SessionId),
    sessionTokenGenerator: fixedIdGenerator("token_1"),
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

function fixedClock(now: Date): Clock {
  return {
    now() {
      return new Date(now.getTime());
    },
  };
}

function fixedIdGenerator<Id extends string>(id: Id): IdGenerator<Id> {
  return {
    async generateId(): Promise<IdGeneratorResult<Id>> {
      return success(id);
    },
  };
}

function failingIdGenerator<Id extends string>(): IdGenerator<Id> {
  return {
    async generateId(): Promise<IdGeneratorResult<Id>> {
      return {
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message: "ID service is unavailable.",
        },
      };
    },
  };
}

function failingTokenHasher(): TokenHasher {
  return {
    async hashToken(): Promise<TokenHasherResult<TokenHash>> {
      return {
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message: "Hash service is unavailable.",
        },
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
