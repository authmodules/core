export type IdGeneratorErrorCode = "UNAVAILABLE";

export interface IdGeneratorError {
  readonly code: IdGeneratorErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type IdGeneratorResult<Id extends string> =
  | {
      readonly ok: true;
      readonly value: Id;
    }
  | {
      readonly ok: false;
      readonly error: IdGeneratorError;
    };

export interface IdGenerator<Id extends string = string> {
  generateId(): Promise<IdGeneratorResult<Id>>;
}
