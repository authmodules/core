import { cloneDate, createNonEmptyString } from "./shared.js";
import type { Brand } from "./shared.js";
import type { UserId } from "./user.js";

export type SessionId = Brand<string, "SessionId">;

export interface Session {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface CreateSessionInput {
  readonly id: string;
  readonly userId: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt?: Date | null;
}

export function createSessionId(value: string): SessionId {
  return createNonEmptyString<"SessionId">(value, "Session id");
}

export function createSession(input: CreateSessionInput): Session {
  const createdAt = cloneDate(input.createdAt, "Session createdAt");
  const updatedAt = cloneDate(input.updatedAt, "Session updatedAt");
  const expiresAt = cloneDate(input.expiresAt, "Session expiresAt");
  const revokedAt =
    input.revokedAt === undefined || input.revokedAt === null
      ? null
      : cloneDate(input.revokedAt, "Session revokedAt");

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError("Session updatedAt must be greater than or equal to createdAt.");
  }

  if (expiresAt.getTime() <= createdAt.getTime()) {
    throw new RangeError("Session expiresAt must be greater than createdAt.");
  }

  if (revokedAt !== null && revokedAt.getTime() < createdAt.getTime()) {
    throw new RangeError("Session revokedAt must be greater than or equal to createdAt.");
  }

  return Object.freeze({
    id: createSessionId(input.id),
    userId: input.userId,
    get createdAt() {
      return new Date(createdAt.getTime());
    },
    get updatedAt() {
      return new Date(updatedAt.getTime());
    },
    get expiresAt() {
      return new Date(expiresAt.getTime());
    },
    get revokedAt() {
      return revokedAt === null ? null : new Date(revokedAt.getTime());
    },
  });
}
