/**
 * Facts Manager - Main Entry Point
 *
 * Barrel export and public API for facts management module.
 *
 * Phase 1: TypeScript ES Modules
 * Bundle: facts.min.js (IIFE format for global scope)
 */

// ============================================================================
// Core Exports
// ============================================================================

export {
    initializeState,
    getState,
    updateState,
    resetState
} from './core/FactsState';

export * from './core/stateManager';

// ============================================================================
// Operations Exports
// ============================================================================

export * from './operations/filterOperations';
export * from './operations/paginationOperations';
export * from './operations/selectionOperations';

// ============================================================================
// Integration Exports
// ============================================================================

export * from './integration/factsAPI';
export * from './integration/dropdownAPI';
export * from './integration/analyticsAPI';

// ============================================================================
// Rendering Exports (Temporary - Phase 1 only)
// ============================================================================

export * from './rendering/factsTable';
export * from './rendering/statsRenderer';

// ============================================================================
// Window Exports Setup
// ============================================================================

import { setupWindowExports } from './adapters/windowExports';
export { setupWindowExports };

// ============================================================================
// Initialization
// ============================================================================

import { initializeState } from './core/FactsState';

/**
 * Initialize Facts Manager
 * Called automatically on DOMContentLoaded
 */
export function initialize(): void {
    // Initialize state
    initializeState();

    // Setup window exports for onclick compatibility
    setupWindowExports();

    // TODO: Full initialization (load dropdowns, etc.) will be added later
    console.warn('[FactsManager] Basic initialization complete (Phase 1 - partial)');
}

// ============================================================================
// Auto-Initialize on DOM Ready
// ============================================================================

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM already loaded
        initialize();
    }
}
