/**
 * Custom error types for PGlite
 */

export class PGliteError extends Error {
  constructor(
    message: string,
    public readonly code?: string  // eslint-disable-line no-unused-vars
  ) {
    super(message);
    this.name = 'PGliteError';
  }
}

export class PGliteInitError extends PGliteError {
  constructor(message: string) {
    super(message, 'INIT_ERROR');
    this.name = 'PGliteInitError';
  }
}
