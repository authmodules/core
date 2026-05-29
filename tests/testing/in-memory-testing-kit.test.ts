import { describe, expect, it } from "vitest";

import {
  DeterministicTokenHasher,
  FixedClock,
  InMemoryAuthStore,
  SequentialIdGenerator,
  createIdentity,
  createInMemoryTestingKit,
  createSession,
  createUser,
  getSession,
  revokeSession,
  signInWithIdentity,
  type SessionId,
  type TokenHash,
  type UserId,
} from "../../src/index.js";

describe("InMemoryAuthStore", () => {
  it("stores and finds users, identities, and sessions through the AuthStore port", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const user = createUser({
      id: "user_1",
      createdAt: now,
      updatedAt: now,
    });
    const identity = createIdentity({
      id: "identity_1",
      userId: user.id,
      provider: "github",
      subject: "123",
      createdAt: now,
      updatedAt: now,
    });
    const session = createSession({
      id: "session_1",
      userId: user.id,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date("2026-01-01T01:00:00.000Z"),
    });
    const store = new InMemoryAuthStore();

    await expect(store.saveUser(user)).resolves.toEqual({ ok: true, value: undefined });
    await expect(store.saveIdentity(identity)).resolves.toEqual({ ok: true, value: undefined });
    await expect(
      store.saveSession({
        session,
        tokenHash: "test-token-hash:token_1" as TokenHash,
      }),
    ).resolves.toEqual({ ok: true, value: undefined });

    await expect(store.findUserById(user.id)).resolves.toEqual({ ok: true, value: user });
    await expect(
      store.findIdentityByProviderAndSubject({
        provider: identity.provider,
        subject: identity.subject,
      }),
    ).resolves.toEqual({ ok: true, value: identity });
    await expect(store.findSessionById(session.id)).resolves.toEqual({ ok: true, value: session });
    await expect(
      store.findSessionByTokenHash("test-token-hash:token_1" as TokenHash),
    ).resolves.toEqual({ ok: true, value: session });
  });

  it("returns conflicts for duplicate users, identities, sessions, and token hashes", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const user = createUser({
      id: "user_1",
      createdAt: now,
      updatedAt: now,
    });
    const identity = createIdentity({
      id: "identity_1",
      userId: user.id,
      provider: "github",
      subject: "123",
      createdAt: now,
      updatedAt: now,
    });
    const session = createSession({
      id: "session_1",
      userId: user.id,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date("2026-01-01T01:00:00.000Z"),
    });
    const store = new InMemoryAuthStore({
      users: [user],
      identities: [identity],
      sessions: [
        {
          session,
          tokenHash: "test-token-hash:token_1" as TokenHash,
        },
      ],
    });

    await expect(store.saveUser(user)).resolves.toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "User already exists.",
      },
    });
    await expect(store.saveIdentity(identity)).resolves.toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Identity already exists.",
      },
    });
    await expect(
      store.saveSession({
        session,
        tokenHash: "test-token-hash:token_1" as TokenHash,
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Session already exists.",
      },
    });
  });

  it("updates an existing session and reports missing sessions as unavailable", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const user = createUser({
      id: "user_1",
      createdAt: now,
      updatedAt: now,
    });
    const session = createSession({
      id: "session_1",
      userId: user.id,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date("2026-01-01T01:00:00.000Z"),
    });
    const updatedSession = createSession({
      id: session.id,
      userId: user.id,
      createdAt: session.createdAt,
      updatedAt: new Date("2026-01-01T00:30:00.000Z"),
      expiresAt: session.expiresAt,
      revokedAt: new Date("2026-01-01T00:30:00.000Z"),
    });
    const missingSession = createSession({
      id: "session_missing",
      userId: user.id,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date("2026-01-01T01:00:00.000Z"),
    });
    const store = new InMemoryAuthStore({
      sessions: [
        {
          session,
          tokenHash: "test-token-hash:token_1" as TokenHash,
        },
      ],
    });

    await expect(store.updateSession(updatedSession)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(
      store.findSessionByTokenHash("test-token-hash:token_1" as TokenHash),
    ).resolves.toEqual({ ok: true, value: updatedSession });
    await expect(store.updateSession(missingSession)).resolves.toEqual({
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "Session was not found.",
      },
    });
  });
});

describe("testing dependency helpers", () => {
  it("provides a mutable fixed clock with defensive Date copies", () => {
    const initial = new Date("2026-01-01T00:00:00.000Z");
    const clock = new FixedClock(initial);
    const firstNow = clock.now();

    firstNow.setUTCFullYear(2030);
    clock.advanceBy(60_000);

    expect(clock.now()).toEqual(new Date("2026-01-01T00:01:00.000Z"));

    clock.setNow(new Date("2026-01-01T01:00:00.000Z"));

    expect(clock.now()).toEqual(new Date("2026-01-01T01:00:00.000Z"));
  });

  it("generates deterministic sequential IDs", async () => {
    const generator = new SequentialIdGenerator<UserId>("user_", 2);

    await expect(generator.generateId()).resolves.toEqual({ ok: true, value: "user_2" });
    await expect(generator.generateId()).resolves.toEqual({ ok: true, value: "user_3" });
  });

  it("hashes and verifies tokens deterministically for tests", async () => {
    const tokenHasher = new DeterministicTokenHasher();

    await expect(tokenHasher.hashToken("token_1")).resolves.toEqual({
      ok: true,
      value: "test-token-hash:token_1",
    });
    await expect(
      tokenHasher.verifyToken({
        token: "token_1",
        tokenHash: "test-token-hash:token_1" as TokenHash,
      }),
    ).resolves.toEqual({ ok: true, value: true });
    await expect(tokenHasher.hashToken(" ")).resolves.toEqual({
      ok: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Token must be a non-empty string.",
      },
    });
  });
});

describe("createInMemoryTestingKit", () => {
  it("wires the existing sign-in, get-session, and revoke-session use cases", async () => {
    const kit = createInMemoryTestingKit({
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    const signInResult = await signInWithIdentity(
      {
        provider: "github",
        subject: "123",
        sessionDurationMs: 3_600_000,
      },
      kit,
    );

    expect(signInResult.ok).toBe(true);

    if (!signInResult.ok) {
      return;
    }

    expect(signInResult.value.user.id).toBe("user_1");
    expect(signInResult.value.identity.id).toBe("identity_1");
    expect(signInResult.value.session.id).toBe("session_1" as SessionId);
    expect(signInResult.value.sessionToken).toBe("session_token_1");

    const getResult = await getSession(
      {
        sessionToken: signInResult.value.sessionToken,
      },
      kit,
    );

    expect(getResult).toEqual({
      ok: true,
      value: {
        session: signInResult.value.session,
      },
    });

    const revokeResult = await revokeSession(
      {
        sessionToken: signInResult.value.sessionToken,
      },
      kit,
    );

    expect(revokeResult.ok).toBe(true);

    if (!revokeResult.ok) {
      return;
    }

    expect(revokeResult.value.session.revokedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });
});
