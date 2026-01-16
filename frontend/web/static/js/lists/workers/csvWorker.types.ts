/**
 * CSV Worker Message Types
 *
 * Type-safe interface for CSV Worker communication.
 * Used by both worker (csvWorker.ts) and client (csvWorkerClient.ts).
 *
 * @version 2.0.0 (TypeScript migration)
 */

// ============================================================================
// Action Types (Discriminated Union)
// ============================================================================

export type CSVWorkerAction =
  | 'encodeBase64'
  | 'parseCSV'
  | 'validateRows'
  | 'detectDelimiter';

// ============================================================================
// Request Message Types
// ============================================================================

/** Base request structure */
export interface CSVWorkerRequestBase {
  id: string;
  timestamp: number;
}

/** encodeBase64 action request */
export interface EncodeBase64Request extends CSVWorkerRequestBase {
  action: 'encodeBase64';
  data: {
    content: string;
  };
  options?: {
    chunkSize?: number; // Default: 524288 (512KB)
  };
}

/** parseCSV action request */
export interface ParseCSVRequest extends CSVWorkerRequestBase {
  action: 'parseCSV';
  data: {
    content: string;
  };
  options?: {
    delimiter?: string;
    hasHeader?: boolean;
    maxRows?: number;
  };
}

/** Schema rule for row validation */
export interface ValidationSchemaRule {
  required?: boolean;
  type?: 'string' | 'number' | 'date';
  pattern?: string; // RegExp pattern string
}

/** Validation schema */
export interface ValidationSchema {
  [columnName: string]: ValidationSchemaRule;
}

/** validateRows action request */
export interface ValidateRowsRequest extends CSVWorkerRequestBase {
  action: 'validateRows';
  data: {
    rows: Record<string, string>[];
    schema?: ValidationSchema;
  };
}

/** detectDelimiter action request */
export interface DetectDelimiterRequest extends CSVWorkerRequestBase {
  action: 'detectDelimiter';
  data: {
    headerLine: string;
  };
}

/** Union type for all requests */
export type CSVWorkerRequest =
  | EncodeBase64Request
  | ParseCSVRequest
  | ValidateRowsRequest
  | DetectDelimiterRequest;

// ============================================================================
// Response Message Types
// ============================================================================

/** Error structure in response */
export interface WorkerError {
  message: string;
  code: string;
  stack?: string;
}

/** Base response structure */
export interface CSVWorkerResponseBase {
  id: string;
  success: boolean;
  duration: number;
  timestamp: number;
}

/** Success response */
export interface CSVWorkerSuccessResponse<T> extends CSVWorkerResponseBase {
  success: true;
  result: T;
  error: null;
}

/** Error response */
export interface CSVWorkerErrorResponse extends CSVWorkerResponseBase {
  success: false;
  result: null;
  error: WorkerError;
}

/** Union for success/error */
export type CSVWorkerResponse<T> =
  | CSVWorkerSuccessResponse<T>
  | CSVWorkerErrorResponse;

// ============================================================================
// Result Types (per action)
// ============================================================================

/** Result of encodeBase64 */
export type EncodeBase64Result = string;

/** Result of parseCSV */
export interface ParseCSVResult {
  delimiter: string;
  header: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  parsedRows: number;
  duration: number;
}

/** Invalid row in validation result */
export interface InvalidRow {
  rowIndex: number;
  row: Record<string, string>;
  errors: string[];
}

/** Result of validateRows */
export interface ValidateRowsResult {
  validRows: Record<string, string>[];
  invalidRows: InvalidRow[];
  errors: string[];
  validCount: number;
  invalidCount: number;
  duration: number;
}

/** Result of detectDelimiter */
export type DetectDelimiterResult = string;

// ============================================================================
// Progress/Warning Messages (one-way from worker)
// ============================================================================

export interface WorkerProgressMessage {
  type: 'progress';
  message: string;
}

export interface WorkerWarningMessage {
  type: 'warning';
  message: string;
}

export interface WorkerInitializedMessage {
  type: 'initialized';
  workerType: 'csv';
  version: string;
  timestamp: number;
}

/** Non-response messages from worker */
export type CSVWorkerNotification =
  | WorkerProgressMessage
  | WorkerWarningMessage
  | WorkerInitializedMessage;

// ============================================================================
// Type Guards
// ============================================================================

export function isProgressMessage(msg: unknown): msg is WorkerProgressMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as WorkerProgressMessage).type === 'progress'
  );
}

export function isWarningMessage(msg: unknown): msg is WorkerWarningMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as WorkerWarningMessage).type === 'warning'
  );
}

export function isInitializedMessage(
  msg: unknown
): msg is WorkerInitializedMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as WorkerInitializedMessage).type === 'initialized'
  );
}

export function isResponse(msg: unknown): msg is CSVWorkerResponse<unknown> {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof (msg as CSVWorkerResponse<unknown>).id === 'string' &&
    typeof (msg as CSVWorkerResponse<unknown>).success === 'boolean'
  );
}
