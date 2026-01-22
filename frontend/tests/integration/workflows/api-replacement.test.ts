/**
 * API Replacement Integration Tests (task-015 Phase 6)
 *
 * Tests for PGlite-first architecture with API fallback.
 * Validates:
 * - Shopping Lists load/fallback/performance
 * - Facts load with filters/count/performance
 * - Recurring Plans load with filters
 * - Performance: 80%+ API reduction target
 *
 * @group integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PGliteManager } from '@db/pglite';
import { dataLayer } from '../../../web/static/js/data/DataLayer';
import { performanceMonitor } from '../../../web/static/js/monitoring/PerformanceMonitor';

describe('API Replacement Integration Tests', () => {
  let pglite: PGliteManager;

  beforeAll(async () => {
    // Initialize PGlite
    pglite = new PGliteManager();
    await pglite.init();

    // Clear performance metrics
    performanceMonitor.reset();
  });

  afterAll(async () => {
    // Cleanup
    await pglite.close();
  });

  beforeEach(() => {
    // Reset performance metrics before each test
    performanceMonitor.reset();
  });

  describe('Shopping Lists - PGlite-first Strategy', () => {
    it('should load shopping lists from PGlite when available', async () => {
      // Act
      const lists = await dataLayer.getShoppingLists({ is_active: true });

      // Assert
      expect(lists).toBeDefined();
      expect(Array.isArray(lists)).toBe(true);

      // Check performance tracking
      const stats = performanceMonitor.getStats();
      expect(stats.pglite.count).toBeGreaterThan(0);
      expect(stats.api.count).toBe(0); // Should NOT call API if PGlite ready
    });

    it('should track performance for shopping list queries', async () => {
      // Act
      await dataLayer.getShoppingLists({ is_active: true });

      // Assert
      const stats = performanceMonitor.getStats();
      expect(stats.pglite.avgDurationMs).toBeLessThan(100); // Target: <100ms
    });

    it('should handle filters correctly', async () => {
      // Act
      const activeLists = await dataLayer.getShoppingLists({ is_active: true });
      const allLists = await dataLayer.getShoppingLists({});

      // Assert
      expect(activeLists.length).toBeLessThanOrEqual(allLists.length);
    });
  });

  describe('Facts - PGlite-first Strategy', () => {
    it('should load facts from PGlite when available', async () => {
      // Arrange
      const filters = {
        record_type: 'fact' as const,
        user_id: 1
      };

      // Act
      const facts = await dataLayer.getFacts(filters);

      // Assert
      expect(facts).toBeDefined();
      expect(Array.isArray(facts)).toBe(true);

      // Check performance tracking
      const stats = performanceMonitor.getStats();
      expect(stats.pglite.count).toBeGreaterThan(0);
    });

    it('should load facts count from PGlite', async () => {
      // Arrange
      const filters = {
        record_type: 'fact' as const,
        user_id: 1
      };

      // Act
      const count = await dataLayer.getFactsCount(filters);

      // Assert
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should track performance for facts queries', async () => {
      // Act
      await dataLayer.getFacts({ record_type: 'fact' });

      // Assert
      const stats = performanceMonitor.getStats();
      expect(stats.pglite.avgDurationMs).toBeLessThan(100); // Target: <100ms
    });
  });

  describe('Recurring Plans - PGlite-first Strategy', () => {
    it('should load recurring plans from PGlite when available', async () => {
      // Arrange
      const filters = { is_active: true };

      // Act
      const plans = await dataLayer.getRecurringPlans(filters);

      // Assert
      expect(plans).toBeDefined();
      expect(Array.isArray(plans)).toBe(true);

      // Check performance tracking
      const stats = performanceMonitor.getStats();
      expect(stats.pglite.count).toBeGreaterThan(0);
    });

    it('should handle filters correctly', async () => {
      // Act
      const activePlans = await dataLayer.getRecurringPlans({ is_active: true });
      const allPlans = await dataLayer.getRecurringPlans({});

      // Assert
      expect(activePlans.length).toBeLessThanOrEqual(allPlans.length);
    });
  });

  describe('Reference Data - PGlite-first Strategy', () => {
    it('should load articles from PGlite', async () => {
      // Act
      const articles = await dataLayer.getArticles();

      // Assert
      expect(articles).toBeDefined();
      expect(Array.isArray(articles)).toBe(true);
    });

    it('should load financial centers from PGlite', async () => {
      // Arrange
      const userId = 1;

      // Act
      const centers = await dataLayer.getFinancialCenters(userId);

      // Assert
      expect(centers).toBeDefined();
      expect(Array.isArray(centers)).toBe(true);
    });

    it('should load cost centers from PGlite', async () => {
      // Arrange
      const userId = 1;

      // Act
      const centers = await dataLayer.getCostCenters(userId);

      // Assert
      expect(centers).toBeDefined();
      expect(Array.isArray(centers)).toBe(true);
    });
  });

  describe('Performance Metrics - 80%+ API Reduction Target', () => {
    it('should achieve 80%+ API reduction', async () => {
      // Act: Simulate typical user session
      await dataLayer.getArticles();
      await dataLayer.getFinancialCenters(1);
      await dataLayer.getCostCenters(1);
      await dataLayer.getShoppingLists({ is_active: true });
      await dataLayer.getFacts({ record_type: 'fact', user_id: 1 });
      await dataLayer.getFactsCount({ record_type: 'fact', user_id: 1 });
      await dataLayer.getRecurringPlans({ is_active: true });

      // Assert
      const stats = performanceMonitor.getStats();
      expect(stats.reductionPercent).toBeGreaterThanOrEqual(80);
    });

    it('should show faster PGlite queries vs API', async () => {
      // Act: Run multiple queries
      await dataLayer.getArticles();
      await dataLayer.getFinancialCenters(1);
      await dataLayer.getFacts({ record_type: 'fact', user_id: 1 });

      // Assert
      const stats = performanceMonitor.getStats();
      expect(stats.speedupFactor).toBeGreaterThan(1); // PGlite should be faster
      expect(stats.pglite.avgDurationMs).toBeLessThan(stats.api.avgDurationMs || 100);
    });

    it('should track bandwidth savings', async () => {
      // Act
      await dataLayer.getShoppingLists({ is_active: true });
      await dataLayer.getFacts({ record_type: 'fact', user_id: 1 });
      await dataLayer.getRecurringPlans({ is_active: true });

      // Assert
      const detailedStats = performanceMonitor.getDetailedStats();
      expect(detailedStats.totalBandwidthSaved).toBeGreaterThan(0);
      expect(detailedStats.apiCallsReduced).toBeGreaterThan(0);
    });
  });

  describe('Module Breakdown - Detailed Performance Tracking', () => {
    it('should classify shopping lists queries correctly', async () => {
      // Act
      await dataLayer.getShoppingLists({ is_active: true });
      await dataLayer.getStores();
      await dataLayer.getProductGroups();

      // Assert
      const stats = performanceMonitor.getDetailedStats();
      expect(stats.breakdown.shoppingLists.pglite).toBeGreaterThan(0);
      expect(stats.breakdown.shoppingLists.reductionPercent).toBeGreaterThanOrEqual(0);
    });

    it('should classify facts queries correctly', async () => {
      // Act
      await dataLayer.getFacts({ record_type: 'fact', user_id: 1 });
      await dataLayer.getFactsCount({ record_type: 'fact', user_id: 1 });

      // Assert
      const stats = performanceMonitor.getDetailedStats();
      expect(stats.breakdown.facts.pglite).toBeGreaterThan(0);
    });

    it('should classify recurring plans queries correctly', async () => {
      // Act
      await dataLayer.getRecurringPlans({ is_active: true });

      // Assert
      const stats = performanceMonitor.getDetailedStats();
      expect(stats.breakdown.recurringPlans.pglite).toBeGreaterThan(0);
    });
  });

  describe('Error Handling - Graceful API Fallback', () => {
    it('should fallback to API when PGlite unavailable', async () => {
      // Arrange: Mock PGlite as not ready
      const originalIsReady = pglite.isReady;
      pglite.isReady = () => false;

      // Act
      const articles = await dataLayer.getArticles();

      // Assert
      expect(articles).toBeDefined();
      const stats = performanceMonitor.getStats();
      // Should have fallen back to API
      expect(stats.api.count).toBeGreaterThan(0);

      // Cleanup
      pglite.isReady = originalIsReady;
    });
  });
});
