/** Result type for explicit success/failure (SEC-15: no throwing across boundaries). */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
