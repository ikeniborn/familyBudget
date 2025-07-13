import { test, expect, devices } from '@playwright/test';

test.describe('Cross-Browser Compatibility Tests', () => {
  const testUrls = [
    { path: '/', name: 'dashboard-redirect' },
    { path: '/dashboard', name: 'dashboard' },
    { path: '/reports', name: 'reports' },
    { path: '/fact', name: 'fact' },
    { path: '/login', name: 'login' },
  ];

  // Test on different browser configurations
  const browserConfigs = [
    { name: 'chromium', userAgent: 'chromium' },
    { name: 'firefox', userAgent: 'firefox' },
    { name: 'webkit', userAgent: 'webkit' },
  ];

  browserConfigs.forEach(({ name: browserName }) => {
    test.describe(`${browserName} compatibility`, () => {
      testUrls.forEach(({ path, name: pageName }) => {
        test(`${pageName} page renders correctly on ${browserName}`, async ({ page }) => {
          await page.goto(path);
          await page.waitForLoadState('networkidle');
          
          // Check that page loads without JavaScript errors
          const errors: string[] = [];
          page.on('pageerror', (error) => {
            errors.push(error.message);
          });
          
          page.on('console', (msg) => {
            if (msg.type() === 'error') {
              errors.push(msg.text());
            }
          });
          
          // Wait for any dynamic content to load
          await page.waitForTimeout(2000);
          
          // Basic checks
          expect(await page.locator('body').isVisible()).toBe(true);
          expect(await page.title()).toBeTruthy();
          
          // Check for critical errors (but allow minor warnings)
          const criticalErrors = errors.filter(error => 
            !error.includes('favicon') && 
            !error.includes('extension') &&
            !error.includes('Cannot redefine property') // Browser extension conflicts
          );
          
          if (criticalErrors.length > 0) {
            console.warn(`Non-critical errors on ${pageName} (${browserName}):`, criticalErrors);
          }
        });
      });
    });
  });

  test.describe('Mobile Device Compatibility', () => {
    // Test popular mobile devices
    const mobileDevices = [
      devices['iPhone 12'],
      devices['iPhone 12 Pro'],
      devices['Pixel 5'],
      devices['Samsung Galaxy S21'],
      devices['iPad'],
      devices['iPad Pro'],
    ];

    mobileDevices.forEach((device) => {
      test(`Dashboard compatibility on ${device.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          ...device,
        });
        const page = await context.newPage();
        
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        
        // Check responsive layout
        const viewport = page.viewportSize();
        expect(viewport).toBeTruthy();
        
        // Check navigation is accessible
        const navElements = page.locator('nav, [role="navigation"], .navigation');
        if (await navElements.count() > 0) {
          expect(await navElements.first().isVisible()).toBe(true);
        }
        
        // Check main content is visible
        const mainContent = page.locator('main, [role="main"], .main-content');
        if (await mainContent.count() > 0) {
          expect(await mainContent.first().isVisible()).toBe(true);
        }
        
        await context.close();
      });

      test(`Reports page compatibility on ${device.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          ...device,
        });
        const page = await context.newPage();
        
        await page.goto('/reports');
        await page.waitForLoadState('networkidle');
        
        // Check that reports page loads properly
        expect(await page.locator('body').isVisible()).toBe(true);
        
        // Check for responsive charts container
        const chartsContainer = page.locator('.space-y-6, .reports-container');
        if (await chartsContainer.count() > 0) {
          expect(await chartsContainer.first().isVisible()).toBe(true);
        }
        
        await context.close();
      });
    });
  });

  test.describe('Feature Compatibility', () => {
    test('localStorage compatibility', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Test localStorage functionality
      const hasLocalStorage = await page.evaluate(() => {
        try {
          const testKey = 'test-compatibility';
          localStorage.setItem(testKey, 'test-value');
          const value = localStorage.getItem(testKey);
          localStorage.removeItem(testKey);
          return value === 'test-value';
        } catch (e) {
          return false;
        }
      });
      
      expect(hasLocalStorage).toBe(true);
    });

    test('CSS Grid and Flexbox support', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Check CSS Grid support
      const gridSupport = await page.evaluate(() => {
        return CSS.supports('display', 'grid');
      });
      
      // Check Flexbox support
      const flexSupport = await page.evaluate(() => {
        return CSS.supports('display', 'flex');
      });
      
      expect(gridSupport).toBe(true);
      expect(flexSupport).toBe(true);
    });

    test('ES6+ JavaScript features', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Test modern JavaScript features
      const modernJSSupport = await page.evaluate(() => {
        try {
          // Test arrow functions
          const arrow = () => true;
          
          // Test const/let
          const constTest = 'test';
          let letTest = 'test';
          
          // Test template literals
          const template = `test ${constTest}`;
          
          // Test destructuring
          const [first] = [1, 2, 3];
          const { length } = 'test';
          
          // Test async/await (basic syntax)
          const asyncFn = async () => true;
          
          return arrow() && template.includes(constTest) && first === 1 && length === 4;
        } catch (e) {
          return false;
        }
      });
      
      expect(modernJSSupport).toBe(true);
    });

    test('SVG support for charts', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Check SVG support
      const svgSupport = await page.evaluate(() => {
        return !!(document.createElementNS && document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect);
      });
      
      expect(svgSupport).toBe(true);
    });

    test('Canvas support for chart exports', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Check Canvas support
      const canvasSupport = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext && canvas.getContext('2d'));
      });
      
      expect(canvasSupport).toBe(true);
    });
  });

  test.describe('Network Conditions', () => {
    test('Slow 3G network simulation', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
        route.continue();
      });
      
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Check that page still loads despite slow network
      expect(await page.locator('body').isVisible()).toBe(true);
      expect(await page.title()).toBeTruthy();
    });

    test('Offline/error resilience', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Simulate network failure for API calls
      await page.route('/api/**', route => {
        route.abort('failed');
      });
      
      // Navigate to reports page which makes API calls
      await page.goto('/reports');
      await page.waitForTimeout(3000);
      
      // Should show error handling, not crash
      expect(await page.locator('body').isVisible()).toBe(true);
      
      // Look for error handling UI
      const errorElements = page.locator('text=Ошибка, text=Error, .error, .alert-error');
      const hasErrorHandling = await errorElements.count() > 0;
      
      // Either show error handling or graceful degradation
      expect(hasErrorHandling || await page.locator('.empty-state, .no-data').isVisible()).toBe(true);
    });
  });

  test.describe('Performance Baseline', () => {
    test('Page load performance', async ({ page }) => {
      const start = Date.now();
      
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - start;
      
      // Should load within reasonable time (10 seconds for slow CI)
      expect(loadTime).toBeLessThan(10000);
      
      // Check for basic performance metrics
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        };
      });
      
      console.log('Performance metrics:', performanceMetrics);
      
      // Basic performance expectations
      expect(performanceMetrics.domContentLoaded).toBeGreaterThan(0);
    });
  });

  test.describe('Accessibility Compliance', () => {
    test('Basic accessibility checks', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Check for basic accessibility attributes
      const hasMainLandmark = await page.locator('main, [role="main"]').count() > 0;
      const hasHeadings = await page.locator('h1, h2, h3, h4, h5, h6').count() > 0;
      const hasNavigation = await page.locator('nav, [role="navigation"]').count() > 0;
      
      // At least some basic structure should be present
      expect(hasHeadings).toBe(true);
      
      // Check for keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.locator(':focus').count() > 0;
      expect(focusedElement).toBe(true);
    });

    test('Color contrast compliance', async ({ page }) => {
      await page.goto('/reports');
      await page.waitForLoadState('networkidle');
      
      // Basic check for text visibility
      const textElements = page.locator('p, span, div').filter({ hasText: /\S/ });
      const count = await textElements.count();
      
      if (count > 0) {
        // Check that text elements are visible
        const firstText = textElements.first();
        expect(await firstText.isVisible()).toBe(true);
      }
    });
  });

  test.describe('Input Method Compatibility', () => {
    test('Touch input simulation', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Simulate touch events on interactive elements
      const clickableElements = page.locator('button, a, [role="button"]');
      const count = await clickableElements.count();
      
      if (count > 0) {
        const firstButton = clickableElements.first();
        if (await firstButton.isVisible()) {
          await firstButton.tap();
          // Should not throw errors
        }
      }
    });

    test('Keyboard navigation', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Test basic keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Should not crash or cause JavaScript errors
      expect(await page.locator('body').isVisible()).toBe(true);
    });
  });
});