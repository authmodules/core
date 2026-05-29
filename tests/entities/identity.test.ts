import { describe, expect, it } from "vitest";

import {
  createIdentity,
  createIdentityProvider,
  createIdentitySubject,
  createUserId,
} from "../../src/index.js";

describe("Identity entity", () => {
  it("creates an identity with provider and subject fields", () => {
    const userId = createUserId("user_1");
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");

    const identity = createIdentity({
      id: "identity_1",
      userId,
      provider: "github",
      subject: "123",
      createdAt,
      updatedAt,
    });

    expect(identity).toEqual({
      id: "identity_1",
      userId,
      provider: "github",
      subject: "123",
      createdAt,
      updatedAt,
    });
    expect(identity.createdAt).not.toBe(createdAt);
    expect(identity.updatedAt).not.toBe(updatedAt);
    expect(Object.isFrozen(identity)).toBe(true);
  });

  it("rejects empty provider and subject values", () => {
    expect(() => createIdentityProvider(" ")).toThrow(TypeError);
    expect(() => createIdentitySubject(" ")).toThrow(TypeError);
  });

  it("rejects an updatedAt date before createdAt", () => {
    expect(() =>
      createIdentity({
        id: "identity_1",
        userId: createUserId("user_1"),
        provider: "github",
        subject: "123",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(RangeError);
  });
});
