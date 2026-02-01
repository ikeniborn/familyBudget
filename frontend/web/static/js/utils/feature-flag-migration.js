/**
 * Feature Flag Migration Utility
 * One-time migration: PGlite → Dexie terminology
 *
 * Renames localStorage keys:
 * - enablePGlite → dexieActive
 * - enableDexie → dexieActive
 * - pglite* → dexie*
 *
 * Safe to run multiple times (idempotent)
 */

export function migrateFeatureFlags() {
    const migrationMapping = {
        'enablePGlite': 'dexieActive',
        'enableDexie': 'dexieActive',
        'pgliteEnableConflictResolution': 'dexieEnableConflictResolution',
        'pgliteEnableAutoPruning': 'dexieEnableAutoPruning',
        'pgliteFactsWindow': 'dexieFactsWindow',
        'pgliteAutoSync': 'dexieAutoSync',
        'pgliteDebug': 'dexieDebug',
        'pgliteRetentionDays': 'dexieRetentionDays'
    };

    let migratedCount = 0;

    Object.entries(migrationMapping).forEach(([oldKey, newKey]) => {
        const value = localStorage.getItem(oldKey);

        if (value !== null) {
            // Copy value to new key
            localStorage.setItem(newKey, value);

            // Remove old key
            localStorage.removeItem(oldKey);

            migratedCount++;
            console.info(`[Migration] Renamed localStorage key: ${oldKey} → ${newKey}`);
        }
    });

    if (migratedCount > 0) {
        console.info(`[Migration] ✅ Migrated ${migratedCount} feature flag keys`);
    } else {
        console.debug('[Migration] No feature flags to migrate');
    }

    return migratedCount;
}

// Auto-run migration on load (one-time)
try {
    migrateFeatureFlags();
} catch (error) {
    console.error('[Migration] ❌ Feature flag migration failed:', error);
}
