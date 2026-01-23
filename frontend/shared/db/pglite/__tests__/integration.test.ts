import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { getState, updateState } from '../core/stateManager';
import { getPGliteFeatureFlags, isPGliteEnabled } from '../features/featureFlags';

describe('PGlite Integration', () => {
  beforeEach(() => {
    // Reset state
    updateState({
      db: null,
      isInitialized: false,
      connectionStatus: 'disconnected',
      lastError: null
    });

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize PGlite instance', { timeout: 30000 }, async () => {
    // Arrange
    const db = new PGlite('idb://test-db');

    // Act
    updateState({
      db,
      isInitialized: true,
      connectionStatus: 'connected'
    });

    // Assert
    const state = getState();
    expect(state.isInitialized).toBe(true);
    expect(state.connectionStatus).toBe('connected');
    expect(state.db).toBeTruthy();

    // Cleanup
    await db.close();
  });

  it('should execute simple query', async () => {
    // Arrange
    const db = new PGlite('idb://test-query');

    // Act
    const result = await db.query('SELECT 1 as value');

    // Assert
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { value: number }).value).toBe(1);

    // Cleanup
    await db.close();
  });

  it('should check feature flag disabled by default', () => {
    // Act
    const isEnabled = isPGliteEnabled();

    // Assert
    expect(isEnabled).toBe(false);
  });

  it('should enable PGlite via feature flag', () => {
    // Arrange
    localStorage.setItem('enablePGlite', 'true');

    // Act
    const isEnabled = isPGliteEnabled();
    const flags = getPGliteFeatureFlags();

    // Assert
    expect(isEnabled).toBe(true);
    expect(flags.enabled).toBe(true);
    expect(flags.factsWindow).toBe(90); // default
    expect(flags.autoSyncInterval).toBe(300000); // default 5 min
  });
});
