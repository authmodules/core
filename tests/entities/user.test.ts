import { describe, expect, it } from "vitest";

import { createUser, createUserId } from "../../src/index.js";

describe("User entity", () => {
  it("creates a user with validated fields", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");

    const user = createUser({
      id: "user_1",
      createdAt,
      updatedAt,
    });

    expect(user).toEqual({
      id: "user_1",
      createdAt,
      updatedAt,
    });
    expect(user.createdAt).not.toBe(createdAt);
    expect(user.updatedAt).not.toBe(updatedAt);
    expect(Object.isFrozen(user)).toBe(true);
  });

  it("rejects an empty user id", () => {
    expect(() => createUserId(" ")).toThrow(TypeError);
  });

  it("rejects an updatedAt date before createdAt", () => {
    expect(() =>
      createUser({
        id: "user_1",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(RangeError);
  });

  it("protects stored dates from external mutation", () => {
    const user = createUser({
      id: "user_1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    user.createdAt.setTime(new Date("2030-01-01T00:00:00.000Z").getTime());

    expect(user.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });
});
