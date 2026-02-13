/**
 * Content hash utilities for deduplication
 */

/**
 * Calculate content hash (SHA-256) for deduplication
 * Uses Web Crypto API for deterministic hashing
 *
 * @param data - Object to hash
 * @returns SHA-256 hash string (hex)
 */
export async function calculateContentHash(data: Record<string, unknown>): Promise<string> {
  // Stringify with sorted keys for deterministic hash
  const normalized = JSON.stringify(data, Object.keys(data).sort());

  // Use Web Crypto API (available in browser and Node 15+)
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Generate UUID v4 for temp_id (LEGACY - use generateNumericTempId for new code)
 *
 * @deprecated Use generateNumericTempId() instead
 * @returns UUID string
 */
export function generateUUID(): string {
  // Use crypto.randomUUID() if available (modern browsers + Node 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback to manual UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate crypto-secure random int53 for temp_id
 *
 * Uses crypto.getRandomValues() for cryptographically strong random generation.
 * Generates numbers within JavaScript MAX_SAFE_INTEGER (2^53 - 1) range.
 *
 * @returns Random int53 number (0 to 9,007,199,254,740,991)
 * @throws Error if crypto API unavailable
 *
 * @example
 * const tempId = generateNumericTempId();
 * // => 4503599627370495 (random int53)
 */
export function generateNumericTempId(): number {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Crypto API unavailable - cannot generate secure temp_id');
  }

  // Generate crypto-secure random int53 (JavaScript MAX_SAFE_INTEGER)
  // Strategy: Combine two Uint32 values to get 53 bits total
  const randomBytes = crypto.getRandomValues(new Uint32Array(2));

  // Take 21 bits from first value (high bits)
  const high = randomBytes[0] & 0x1FFFFF;  // Mask to 21 bits

  // Take all 32 bits from second value (low bits)
  const low = randomBytes[1];

  // Combine: (high * 2^32) + low = 53 bits total
  return (high * 0x100000000) + low;
}

/**
 * Hash UUID string deterministically to int53 number
 *
 * Used for migrating existing UUID temp_id values to numeric format.
 * Converts UUID to numeric representation while maintaining deterministic mapping.
 *
 * @param uuid - UUID string to convert (e.g., "abc123-def456-789")
 * @returns Int53 number derived from UUID
 *
 * @example
 * const uuid = "550e8400-e29b-41d4-a716-446655440000";
 * const numericId = hashStringToInt53(uuid);
 * // => 6004799503160661 (deterministic, same UUID always gives same number)
 *
 * // Idempotent
 * hashStringToInt53(uuid) === hashStringToInt53(uuid); // true
 */
export function hashStringToInt53(uuid: string): number {
  // Remove hyphens and take first 13 hex characters (52 bits)
  const hex = uuid.replace(/-/g, '').substring(0, 13);

  // Convert hex to number
  const value = parseInt(hex, 16);

  // Ensure result is within MAX_SAFE_INTEGER (modulo operation)
  return value % Number.MAX_SAFE_INTEGER;
}
