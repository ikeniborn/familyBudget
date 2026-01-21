/**
 * Dependency Injection types for PGlite
 */

export interface IPGliteConfig {
  dataDir?: string;             // IndexedDB namespace (default: 'pglite')
  debug?: boolean;              // Enable debug logging (default: NODE_ENV !== 'production')
  relaxedDurability?: boolean;  // Faster writes (default: false)
}
