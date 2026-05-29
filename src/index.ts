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
