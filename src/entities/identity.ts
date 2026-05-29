import { cloneDate, createNonEmptyString } from "./shared.js";
import type { Brand } from "./shared.js";
import type { UserId } from "./user.js";

export type IdentityId = Brand<string, "IdentityId">;
export type IdentityProvider = Brand<string, "IdentityProvider">;
export type IdentitySubject = Brand<string, "IdentitySubject">;

export interface Identity {
  readonly id: IdentityId;
  readonly userId: UserId;
  readonly provider: IdentityProvider;
  readonly subject: IdentitySubject;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateIdentityInput {
  readonly id: string;
  readonly userId: UserId;
  readonly provider: string;
  readonly subject: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createIdentityId(value: string): IdentityId {
  return createNonEmptyString<"IdentityId">(value, "Identity id");
}

export function createIdentityProvider(value: string): IdentityProvider {
  return createNonEmptyString<"IdentityProvider">(value, "Identity provider");
}

export function createIdentitySubject(value: string): IdentitySubject {
  return createNonEmptyString<"IdentitySubject">(value, "Identity subject");
}

export function createIdentity(input: CreateIdentityInput): Identity {
  const createdAt = cloneDate(input.createdAt, "Identity createdAt");
  const updatedAt = cloneDate(input.updatedAt, "Identity updatedAt");

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError("Identity updatedAt must be greater than or equal to createdAt.");
  }

  return Object.freeze({
    id: createIdentityId(input.id),
    userId: input.userId,
    provider: createIdentityProvider(input.provider),
    subject: createIdentitySubject(input.subject),
    get createdAt() {
      return new Date(createdAt.getTime());
    },
    get updatedAt() {
      return new Date(updatedAt.getTime());
    },
  });
}
