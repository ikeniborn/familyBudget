/**
 * Error Type Hierarchy for offlineManager
 * Custom error classes for better error handling and debugging
 */

/**
 * Base class for all offlineManager errors
 */
export class OfflineManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineManagerError';
    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Network-related errors (fetch failures, timeouts, connectivity issues)
 */
export class NetworkError extends OfflineManagerError {
  public readonly isNetworkError = true;
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(message: string, statusCode?: number, endpoint?: string) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }

  /**
   * Create NetworkError from fetch Response
   */
  static fromResponse(response: Response, endpoint?: string): NetworkError {
    return new NetworkError(
      `Network request failed: ${response.status} ${response.statusText}`,
      response.status,
      endpoint || response.url
    );
  }

  /**
   * Create NetworkError for timeout
   */
  static timeout(endpoint: string, timeoutMs: number): NetworkError {
    return new NetworkError(
      `Network request timeout after ${timeoutMs}ms`,
      408, // Request Timeout
      endpoint
    );
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    // Network errors and 5xx server errors are retryable
    return !this.statusCode || this.statusCode >= 500;
  }
}

/**
 * Synchronization errors (sync queue failures, deduplication issues)
 */
export class SyncError extends OfflineManagerError {
  public readonly isSyncError = true;
  public readonly syncItemId?: number;
  public readonly operation?: string;

  constructor(message: string, syncItemId?: number, operation?: string) {
    super(message);
    this.name = 'SyncError';
    this.syncItemId = syncItemId;
    this.operation = operation;
  }

  /**
   * Create SyncError for deduplication conflict
   */
  static duplicate(syncItemId: number, syncHash: string): SyncError {
    return new SyncError(
      `Duplicate sync item detected (sync_hash: ${syncHash})`,
      syncItemId,
      'duplicate_check'
    );
  }

  /**
   * Create SyncError for verification failure
   */
  static verificationFailed(syncItemId: number, serverId: number): SyncError {
    return new SyncError(
      `Sync verification failed: record ${serverId} not found on server`,
      syncItemId,
      'verify'
    );
  }
}

/**
 * Validation errors (invalid data, missing required fields)
 */
export class ValidationError extends OfflineManagerError {
  public readonly isValidationError = true;
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }

  /**
   * Create ValidationError for missing required field
   */
  static missingField(field: string): ValidationError {
    return new ValidationError(
      `Missing required field: ${field}`,
      field
    );
  }

  /**
   * Create ValidationError for invalid value
   */
  static invalidValue(field: string, value: any, expected: string): ValidationError {
    return new ValidationError(
      `Invalid value for field ${field}: expected ${expected}, got ${typeof value}`,
      field,
      value
    );
  }
}

/**
 * IndexedDB-related errors (storage quota, transaction failures)
 */
export class StorageError extends OfflineManagerError {
  public readonly isStorageError = true;
  public readonly quotaExceeded?: boolean;

  constructor(message: string, quotaExceeded = false) {
    super(message);
    this.name = 'StorageError';
    this.quotaExceeded = quotaExceeded;
  }

  /**
   * Create StorageError for quota exceeded
   */
  static quotaExceeded(): StorageError {
    return new StorageError(
      'IndexedDB quota exceeded. Please free up space or clear old data.',
      true
    );
  }

  /**
   * Create StorageError from DOMException
   */
  static fromDOMException(error: DOMException): StorageError {
    if (error.name === 'QuotaExceededError') {
      return StorageError.quotaExceeded();
    }
    return new StorageError(`IndexedDB error: ${error.message}`);
  }
}

/**
 * Type guard to check if error is NetworkError
 */
export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError || error?.isNetworkError === true;
}

/**
 * Type guard to check if error is SyncError
 */
export function isSyncError(error: any): error is SyncError {
  return error instanceof SyncError || error?.isSyncError === true;
}

/**
 * Type guard to check if error is ValidationError
 */
export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError || error?.isValidationError === true;
}

/**
 * Type guard to check if error is StorageError
 */
export function isStorageError(error: any): error is StorageError {
  return error instanceof StorageError || error?.isStorageError === true;
}

/**
 * Helper to determine if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (isNetworkError(error)) {
    return error.isRetryable();
  }
  // Sync errors and storage errors are generally not retryable
  return false;
}
