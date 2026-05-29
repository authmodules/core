import type { Identity } from "../entities/identity.js";
import type { Session, SessionId } from "../entities/session.js";
import type { User, UserId } from "../entities/user.js";
import type {
  AuthStore,
  AuthStoreError,
  AuthStoreIdentityLookup,
  AuthStoreResult,
  AuthStoreSessionRecord,
} from "../ports/auth-store.js";
import type { Clock } from "../ports/clock.js";
import type { IdGenerator, IdGeneratorResult } from "../ports/id-generator.js";
import type {
  TokenHash,
  TokenHasher,
  TokenHasherResult,
  TokenVerificationInput,
} from "../ports/token-hasher.js";
import type { SignInWithIdentityDependencies } from "../use-cases/sign-in-with-identity.js";

export interface InMemoryAuthStoreSeed {
  readonly users?: readonly User[];
  readonly identities?: readonly Identity[];
  readonly sessions?: readonly AuthStoreSessionRecord[];
}

export class InMemoryAuthStore implements AuthStore {
  readonly users: User[] = [];
  readonly identities: Identity[] = [];
  readonly sessions: AuthStoreSessionRecord[] = [];

  constructor(seed: InMemoryAuthStoreSeed = {}) {
    for (const user of seed.users ?? []) {
      this.users.push(user);
    }

    for (const identity of seed.identities ?? []) {
      this.identities.push(identity);
    }

    for (const session of seed.sessions ?? []) {
      this.sessions.push(session);
    }
  }

  async findUserById(userId: UserId): Promise<AuthStoreResult<User | null>> {
    return success(this.users.find((user) => user.id === userId) ?? null);
  }

  async saveUser(user: User): Promise<AuthStoreResult<void>> {
    if (this.users.some((storedUser) => storedUser.id === user.id)) {
      return conflict("User already exists.");
    }

    this.users.push(user);

    return success(undefined);
  }

  async findIdentityByProviderAndSubject(
    lookup: AuthStoreIdentityLookup,
  ): Promise<AuthStoreResult<Identity | null>> {
    return success(
      this.identities.find(
        (identity) => identity.provider === lookup.provider && identity.subject === lookup.subject,
      ) ?? null,
    );
  }

  async saveIdentity(identity: Identity): Promise<AuthStoreResult<void>> {
    if (
      this.identities.some(
        (storedIdentity) =>
          storedIdentity.id === identity.id ||
          (storedIdentity.provider === identity.provider &&
            storedIdentity.subject === identity.subject),
      )
    ) {
      return conflict("Identity already exists.");
    }

    this.identities.push(identity);

    return success(undefined);
  }

  async findSessionById(sessionId: SessionId): Promise<AuthStoreResult<Session | null>> {
    return success(
      this.sessions.find((record) => record.session.id === sessionId)?.session ?? null,
    );
  }

  async findSessionByTokenHash(tokenHash: TokenHash): Promise<AuthStoreResult<Session | null>> {
    return success(this.sessions.find((record) => record.tokenHash === tokenHash)?.session ?? null);
  }

  async saveSession(record: AuthStoreSessionRecord): Promise<AuthStoreResult<void>> {
    if (
      this.sessions.some(
        (storedRecord) =>
          storedRecord.session.id === record.session.id ||
          storedRecord.tokenHash === record.tokenHash,
      )
    ) {
      return conflict("Session already exists.");
    }

    this.sessions.push(record);

    return success(undefined);
  }

  async updateSession(session: Session): Promise<AuthStoreResult<void>> {
    const index = this.sessions.findIndex((record) => record.session.id === session.id);

    if (index < 0) {
      return unavailable("Session was not found.");
    }

    const existingRecord = this.sessions[index];

    if (existingRecord === undefined) {
      return unavailable("Session was not found.");
    }

    this.sessions[index] = {
      ...existingRecord,
      session,
    };

    return success(undefined);
  }
}

export class FixedClock implements Clock {
  #now: Date;

  constructor(now: Date) {
    this.#now = new Date(now.getTime());
  }

  now(): Date {
    return new Date(this.#now.getTime());
  }

  setNow(now: Date): void {
    this.#now = new Date(now.getTime());
  }

  advanceBy(milliseconds: number): void {
    this.#now = new Date(this.#now.getTime() + milliseconds);
  }
}

export class SequentialIdGenerator<Id extends string = string> implements IdGenerator<Id> {
  #next: number;

  constructor(
    private readonly prefix: string,
    start = 1,
  ) {
    this.#next = start;
  }

  async generateId(): Promise<IdGeneratorResult<Id>> {
    const id = `${this.prefix}${this.#next}` as Id;

    this.#next += 1;

    return success(id);
  }
}

export class DeterministicTokenHasher implements TokenHasher {
  async hashToken(token: string): Promise<TokenHasherResult<TokenHash>> {
    if (token.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Token must be a non-empty string.",
        },
      };
    }

    return success(createDeterministicTokenHash(token));
  }

  async verifyToken(input: TokenVerificationInput): Promise<TokenHasherResult<boolean>> {
    if (input.token.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Token must be a non-empty string.",
        },
      };
    }

    return success(createDeterministicTokenHash(input.token) === input.tokenHash);
  }
}

export interface InMemoryTestingKitOptions extends InMemoryAuthStoreSeed {
  readonly now?: Date;
}

export interface InMemoryTestingKit extends SignInWithIdentityDependencies {
  readonly store: InMemoryAuthStore;
  readonly clock: FixedClock;
  readonly userIdGenerator: SequentialIdGenerator<UserId>;
  readonly identityIdGenerator: SequentialIdGenerator<Identity["id"]>;
  readonly sessionIdGenerator: SequentialIdGenerator<SessionId>;
  readonly sessionTokenGenerator: SequentialIdGenerator<string>;
  readonly tokenHasher: DeterministicTokenHasher;
}

export function createInMemoryTestingKit(
  options: InMemoryTestingKitOptions = {},
): InMemoryTestingKit {
  return {
    store: new InMemoryAuthStore(options),
    clock: new FixedClock(options.now ?? new Date("2026-01-01T00:00:00.000Z")),
    userIdGenerator: new SequentialIdGenerator<UserId>("user_"),
    identityIdGenerator: new SequentialIdGenerator<Identity["id"]>("identity_"),
    sessionIdGenerator: new SequentialIdGenerator<SessionId>("session_"),
    sessionTokenGenerator: new SequentialIdGenerator<string>("session_token_"),
    tokenHasher: new DeterministicTokenHasher(),
  };
}

function createDeterministicTokenHash(token: string): TokenHash {
  return `test-token-hash:${token}` as TokenHash;
}

function success<Value>(value: Value): {
  readonly ok: true;
  readonly value: Value;
} {
  return {
    ok: true,
    value,
  };
}

function conflict(message: string): {
  readonly ok: false;
  readonly error: AuthStoreError;
} {
  return {
    ok: false,
    error: {
      code: "CONFLICT",
      message,
    },
  };
}

function unavailable(message: string): {
  readonly ok: false;
  readonly error: AuthStoreError;
} {
  return {
    ok: false,
    error: {
      code: "UNAVAILABLE",
      message,
    },
  };
}
