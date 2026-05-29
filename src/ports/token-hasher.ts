import type { Brand } from "../entities/shared.js";

export type TokenHash = Brand<string, "TokenHash">;

export type TokenHasherErrorCode = "INVALID_TOKEN" | "UNAVAILABLE";

export interface TokenHasherError {
  readonly code: TokenHasherErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type TokenHasherResult<Value> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly error: TokenHasherError;
    };

export interface TokenVerificationInput {
  readonly token: string;
  readonly tokenHash: TokenHash;
}

export interface TokenHasher {
  hashToken(token: string): Promise<TokenHasherResult<TokenHash>>;
  verifyToken(input: TokenVerificationInput): Promise<TokenHasherResult<boolean>>;
}
