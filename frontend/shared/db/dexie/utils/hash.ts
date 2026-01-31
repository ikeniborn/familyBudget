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
 * Generate UUID v4 for temp_id
 *
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
