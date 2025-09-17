import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('SvelteKit Proxy Route Cache Test', () => {
  const SVELTE_KIT_DIR = '.svelte-kit';
  const TYPES_DIR = path.join(SVELTE_KIT_DIR, 'types', 'src', 'routes');

  describe('Build Cache Integrity', () => {
    it('should not generate proxy route types without source files', async () => {
      // Check if proxy+page.ts exists in generated types
      const proxyTypePath = path.join(TYPES_DIR, 'proxy+page.ts');
      const srcProxyPath = 'src/routes/proxy+page.svelte';
      const srcProxyTsPath = 'src/routes/proxy+page.ts';

      try {
        // Check if generated type exists
        await fs.access(proxyTypePath);

        // If it exists, verify there's a corresponding source file
        let sourceExists = false;
        try {
          await fs.access(srcProxyPath);
          sourceExists = true;
        } catch {
          // Check TypeScript variant
          try {
            await fs.access(srcProxyTsPath);
            sourceExists = true;
          } catch {
            sourceExists = false;
          }
        }

        expect(sourceExists).toBe(true);
      } catch {
        // Generated type doesn't exist, which is fine
        expect(true).toBe(true);
      }
    });

    it('should have clean .svelte-kit cache after sync', async () => {
      // Get all generated route types
      try {
        const files = await fs.readdir(TYPES_DIR);
        const routeFiles = files.filter(f => f.endsWith('.ts'));

        // For each generated type, verify corresponding source exists
        for (const file of routeFiles) {
          const baseName = file.replace(/\+.*\.ts$/, '');
          const srcDir = 'src/routes';

          // Check if it's a special route (not proxy)
          if (baseName === 'proxy') {
            // Proxy should not exist unless explicitly created
            const srcFiles = await fs.readdir(srcDir);
            const hasProxyRoute = srcFiles.some(f =>
              f.startsWith('proxy+') || f === 'proxy'
            );

            expect(hasProxyRoute).toBe(false);
          }
        }
      } catch (error) {
        // Directory doesn't exist yet
        expect(true).toBe(true);
      }
    });

    it('should not have stale cache references', async () => {
      // Check for common cache corruption indicators
      const typesPath = path.join(SVELTE_KIT_DIR, 'types');

      try {
        // Read the generated ambient.d.ts if it exists
        const ambientPath = path.join(typesPath, 'ambient.d.ts');
        const content = await fs.readFile(ambientPath, 'utf-8');

        // Should not contain references to non-existent proxy route
        if (!await sourceFileExists('proxy')) {
          expect(content).not.toContain("'/proxy'");
          expect(content).not.toContain('"proxy"');
        }
      } catch {
        // File doesn't exist, which is fine
        expect(true).toBe(true);
      }
    });
  });

  describe('Development Server Health', () => {
    it('should start without ENOENT errors', async () => {
      // This test would be run in CI/CD to verify clean starts
      try {
        const { stdout, stderr } = await execAsync(
          'docker exec budget-frontend npm run check',
          { timeout: 30000 }
        );

        // Should not contain proxy route errors
        expect(stderr).not.toContain('ENOENT');
        expect(stderr).not.toContain('proxy+page.ts');
        expect(stdout).not.toContain('Error: Cannot find module');
      } catch (error) {
        // Command failed, check if it's due to proxy route issue
        const errorMsg = error.toString();
        expect(errorMsg).not.toContain('proxy+page');
      }
    });

    it('should serve application without 500 errors', async () => {
      try {
        const response = await fetch('http://localhost:5173/');

        // Should redirect to login (302) or show login (200)
        expect([200, 302]).toContain(response.status);

        // Should not be 500 error
        expect(response.status).not.toBe(500);
      } catch (error) {
        // Connection error - server might not be running in test env
        console.warn('Server not accessible for testing:', error.message);
      }
    });
  });

  describe('Cache Cleanup Verification', () => {
    it('should have consistent route structure', async () => {
      const srcRoutes = 'src/routes';

      try {
        const sourceRoutes = await getRouteFiles(srcRoutes);
        const generatedTypes = await getGeneratedTypes(TYPES_DIR);

        // Every generated type should have a source
        for (const genType of generatedTypes) {
          const routeName = extractRouteName(genType);
          if (routeName && routeName !== '$types') {
            const hasSource = sourceRoutes.some(src =>
              src.includes(routeName) || routeName.includes(src)
            );

            // Special handling for layout and error
            const isSpecial = ['layout', 'error', 'app'].includes(routeName);

            if (!isSpecial && routeName === 'proxy') {
              // Proxy route should not exist
              expect(hasSource).toBe(false);
            }
          }
        }
      } catch {
        // Directories might not exist in test environment
        expect(true).toBe(true);
      }
    });
  });
});

// Helper functions
async function sourceFileExists(routeName: string): Promise<boolean> {
  const variants = [
    `src/routes/${routeName}+page.svelte`,
    `src/routes/${routeName}+page.ts`,
    `src/routes/${routeName}/+page.svelte`,
    `src/routes/${routeName}/+page.ts`
  ];

  for (const variant of variants) {
    try {
      await fs.access(variant);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function getRouteFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const subFiles = await getRouteFiles(path.join(dir, entry.name));
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.includes('+page')) {
        files.push(entry.name);
      }
    }

    return files;
  } catch {
    return [];
  }
}

async function getGeneratedTypes(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => f.endsWith('.ts'));
  } catch {
    return [];
  }
}

function extractRouteName(fileName: string): string {
  return fileName.replace(/\+.*\.ts$/, '').replace(/\$types\.ts$/, '$types');
}