import { cloneDate, createNonEmptyString } from "./shared.js";
import type { Brand } from "./shared.js";

export type UserId = Brand<string, "UserId">;

export interface User {
  readonly id: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateUserInput {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createUserId(value: string): UserId {
  return createNonEmptyString<"UserId">(value, "User id");
}

export function createUser(input: CreateUserInput): User {
  const createdAt = cloneDate(input.createdAt, "User createdAt");
  const updatedAt = cloneDate(input.updatedAt, "User updatedAt");

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError("User updatedAt must be greater than or equal to createdAt.");
  }

  return Object.freeze({
    id: createUserId(input.id),
    get createdAt() {
      return new Date(createdAt.getTime());
    },
    get updatedAt() {
      return new Date(updatedAt.getTime());
    },
  });
}
