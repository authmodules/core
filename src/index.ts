/**
 * Root public entrypoint for @authmodules/core.
 *
 * Only exports from this module are part of the public API.
 */
export const AUTHMODULES_CORE_PACKAGE = "@authmodules/core";

export {
  createIdentity,
  createIdentityId,
  createIdentityProvider,
  createIdentitySubject,
} from "./entities/identity.js";
export type {
  CreateIdentityInput,
  Identity,
  IdentityId,
  IdentityProvider,
  IdentitySubject,
} from "./entities/identity.js";
export { createSession, createSessionId } from "./entities/session.js";
export type { CreateSessionInput, Session, SessionId } from "./entities/session.js";
export { createUser, createUserId } from "./entities/user.js";
export type { CreateUserInput, User, UserId } from "./entities/user.js";
export type {
  AuthStore,
  AuthStoreError,
  AuthStoreErrorCode,
  AuthStoreIdentityLookup,
  AuthStoreResult,
  AuthStoreSessionRecord,
} from "./ports/auth-store.js";
export type { Clock } from "./ports/clock.js";
export type {
  IdGenerator,
  IdGeneratorError,
  IdGeneratorErrorCode,
  IdGeneratorResult,
} from "./ports/id-generator.js";
export type {
  TokenHash,
  TokenHasher,
  TokenHasherError,
  TokenHasherErrorCode,
  TokenHasherResult,
  TokenVerificationInput,
} from "./ports/token-hasher.js";
export { getSession } from "./use-cases/get-session.js";
export type {
  GetSessionDependencies,
  GetSessionError,
  GetSessionErrorCode,
  GetSessionInput,
  GetSessionOutput,
  GetSessionResult,
} from "./use-cases/get-session.js";
export { revokeSession } from "./use-cases/revoke-session.js";
export type {
  RevokeSessionDependencies,
  RevokeSessionError,
  RevokeSessionErrorCode,
  RevokeSessionInput,
  RevokeSessionOutput,
  RevokeSessionResult,
} from "./use-cases/revoke-session.js";
export { signInWithIdentity } from "./use-cases/sign-in-with-identity.js";
export type {
  SignInWithIdentityDependencies,
  SignInWithIdentityError,
  SignInWithIdentityErrorCode,
  SignInWithIdentityInput,
  SignInWithIdentityOutput,
  SignInWithIdentityResult,
} from "./use-cases/sign-in-with-identity.js";
