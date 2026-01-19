/**
 * Facts Manager - Main Entry Point
 *
 * Barrel export and public API for facts management module.
 *
 * Phase 4: Cleanup & Optimization (Event Delegation)
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
// WebSocket Integration Exports (Phase 3)
// ============================================================================

export * from './integration/wsEventHandlers';

// ============================================================================
// Event Delegation Setup (Phase 4)
// ============================================================================

export * from './adapters/eventDelegation';

// ============================================================================
// Window Exports Setup
// ============================================================================

import { setupWindowExports } from './adapters/windowExports';
export { setupWindowExports };

// ============================================================================
// Initialization
// ============================================================================

import { initializeState } from './core/FactsState';
import { registerWSHandlers } from './integration/wsEventHandlers';
import { setupEventDelegation } from './adapters/eventDelegation';

/**
 * Initialize Facts Manager
 * Called automatically on DOMContentLoaded
 */
export function initialize(): void {
    // Initialize state
    initializeState();

    // Setup window exports for onclick compatibility (HTMX partials)
    setupWindowExports();

    // Phase 3: Register WebSocket handlers for real-time updates
    registerWSHandlers();

    // Phase 4: Setup event delegation for data-action pattern
    setupEventDelegation();

    // Initialization complete (silent)
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
