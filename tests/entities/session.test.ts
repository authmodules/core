import { describe, expect, it } from "vitest";

import { createSession, createSessionId, createUserId } from "../../src/index.js";

describe("Session entity", () => {
  it("creates an active session", () => {
    const userId = createUserId("user_1");
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-02-01T00:00:00.000Z");

    const session = createSession({
      id: "session_1",
      userId,
      createdAt,
      updatedAt,
      expiresAt,
    });

    expect(session).toEqual({
      id: "session_1",
      userId,
      createdAt,
      updatedAt,
      expiresAt,
      revokedAt: null,
    });
    expect(session.createdAt).not.toBe(createdAt);
    expect(session.expiresAt).not.toBe(expiresAt);
    expect(Object.isFrozen(session)).toBe(true);
  });

  it("creates a revoked session snapshot", () => {
    const revokedAt = new Date("2026-01-03T00:00:00.000Z");

    const session = createSession({
      id: "session_1",
      userId: createUserId("user_1"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      revokedAt,
    });

    expect(session.revokedAt).toEqual(revokedAt);
    expect(session.revokedAt).not.toBe(revokedAt);
  });

  it("rejects an empty session id", () => {
    expect(() => createSessionId(" ")).toThrow(TypeError);
  });

  it("rejects a session that does not expire after creation", () => {
    expect(() =>
      createSession({
        id: "session_1",
        userId: createUserId("user_1"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(RangeError);
  });

  it("rejects a session revoked before creation", () => {
    expect(() =>
      createSession({
        id: "session_1",
        userId: createUserId("user_1"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
        revokedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(RangeError);
  });

  it("protects stored dates from external mutation", () => {
    const session = createSession({
      id: "session_1",
      userId: createUserId("user_1"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      revokedAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    session.expiresAt.setTime(new Date("2026-01-01T00:00:00.000Z").getTime());
    session.revokedAt?.setTime(new Date("2030-01-01T00:00:00.000Z").getTime());

    expect(session.expiresAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
    expect(session.revokedAt).toEqual(new Date("2026-01-03T00:00:00.000Z"));
  });
});
