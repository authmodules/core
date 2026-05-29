import type { Identity, IdentityProvider, IdentitySubject } from "../entities/identity.js";
import type { Session, SessionId } from "../entities/session.js";
import type { User, UserId } from "../entities/user.js";
import type { TokenHash } from "./token-hasher.js";

export type AuthStoreErrorCode = "CONFLICT" | "UNAVAILABLE";

export interface AuthStoreError {
  readonly code: AuthStoreErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type AuthStoreResult<Value> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly error: AuthStoreError;
    };

export interface AuthStoreIdentityLookup {
  readonly provider: IdentityProvider;
  readonly subject: IdentitySubject;
}

export interface AuthStoreSessionRecord {
  readonly session: Session;
  readonly tokenHash: TokenHash;
}

export interface AuthStore {
  findUserById(userId: UserId): Promise<AuthStoreResult<User | null>>;
  saveUser(user: User): Promise<AuthStoreResult<void>>;
  findIdentityByProviderAndSubject(
    lookup: AuthStoreIdentityLookup,
  ): Promise<AuthStoreResult<Identity | null>>;
  saveIdentity(identity: Identity): Promise<AuthStoreResult<void>>;
  findSessionById(sessionId: SessionId): Promise<AuthStoreResult<Session | null>>;
  findSessionByTokenHash(tokenHash: TokenHash): Promise<AuthStoreResult<Session | null>>;
  saveSession(record: AuthStoreSessionRecord): Promise<AuthStoreResult<void>>;
  updateSession(session: Session): Promise<AuthStoreResult<void>>;
}
