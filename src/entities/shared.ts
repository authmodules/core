export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export function createNonEmptyString<TValue extends string>(
  value: string,
  fieldName: string,
): Brand<string, TValue> {
  if (value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return value as Brand<string, TValue>;
}

export function cloneDate(value: Date, fieldName: string): Date {
  const timestamp = value.getTime();

  if (Number.isNaN(timestamp)) {
    throw new TypeError(`${fieldName} must be a valid Date.`);
  }

  return new Date(timestamp);
}
