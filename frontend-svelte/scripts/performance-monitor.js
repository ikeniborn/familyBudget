import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance monitoring script
class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.thresholds = {
      fcp: 2000, // First Contentful Paint
      lcp: 2500, // Largest Contentful Paint
      fid: 100,  // First Input Delay
      cls: 0.1,  // Cumulative Layout Shift
      loadTime: 3000,
      bundleSize: 200 * 1024 // 200KB
    };
  }

  async analyzeBundleSize() {
    const buildDir = path.join(__dirname, '../build');
    
    if (!fs.existsSync(buildDir)) {
      console.log('❌ Build directory not found. Run "npm run build" first.');
      return;
    }

    const stats = this.calculateBundleStats(buildDir);
    
    console.log('\n📦 Bundle Analysis');
    console.log('==================');
    console.log(`Total bundle size: ${this.formatBytes(stats.totalSize)}`);
    console.log(`JavaScript: ${this.formatBytes(stats.jsSize)}`);
    console.log(`CSS: ${this.formatBytes(stats.cssSize)}`);
    console.log(`Initial bundle: ${this.formatBytes(stats.initialSize)}`);
    
    // Check thresholds
    if (stats.initialSize > this.thresholds.bundleSize) {
      console.log(`⚠️  Initial bundle size exceeds threshold (${this.formatBytes(this.thresholds.bundleSize)})`);
    } else {
      console.log(`✅ Initial bundle size is within threshold`);
    }

    console.log('\n📊 Chunk Analysis');
    console.log('==================');
    stats.chunks.forEach(chunk => {
      const status = chunk.size > 100 * 1024 ? '⚠️ ' : '✅';
      console.log(`${status} ${chunk.name}: ${this.formatBytes(chunk.size)}`);
    });

    return stats;
  }

  calculateBundleStats(buildDir) {
    const stats = {
      totalSize: 0,
      jsSize: 0,
      cssSize: 0,
      initialSize: 0,
      chunks: []
    };

    const clientDir = path.join(buildDir, '_app');
    if (!fs.existsSync(clientDir)) {
      return stats;
    }

    const immutableDir = path.join(clientDir, 'immutable');
    if (fs.existsSync(immutableDir)) {
      // Analyze chunks
      const chunksDir = path.join(immutableDir, 'chunks');
      if (fs.existsSync(chunksDir)) {
        const chunkFiles = fs.readdirSync(chunksDir);
        chunkFiles.forEach(file => {
          const filePath = path.join(chunksDir, file);
          const stat = fs.statSync(filePath);
          const size = stat.size;
          
          stats.totalSize += size;
          
          if (file.endsWith('.js')) {
            stats.jsSize += size;
            stats.chunks.push({ name: file, size, type: 'js' });
            
            // Assume main app chunks contribute to initial load
            if (file.includes('app') || file.includes('index') || file.includes('entry')) {
              stats.initialSize += size;
            }
          } else if (file.endsWith('.css')) {
            stats.cssSize += size;
            stats.chunks.push({ name: file, size, type: 'css' });
            stats.initialSize += size; // CSS is usually loaded initially
          }
        });
      }
    }

    // Sort chunks by size (largest first)
    stats.chunks.sort((a, b) => b.size - a.size);

    return stats;
  }

  generatePerformanceBudget() {
    const budget = {
      resourceSizes: [
        {
          resourceType: 'script',
          budget: 200 * 1024 // 200KB
        },
        {
          resourceType: 'stylesheet', 
          budget: 50 * 1024 // 50KB
        },
        {
          resourceType: 'image',
          budget: 500 * 1024 // 500KB total images
        },
        {
          resourceType: 'font',
          budget: 100 * 1024 // 100KB total fonts
        }
      ],
      resourceCounts: [
        {
          resourceType: 'script',
          budget: 10
        },
        {
          resourceType: 'stylesheet',
          budget: 5
        }
      ]
    };

    const budgetPath = path.join(__dirname, '../performance-budget.json');
    fs.writeFileSync(budgetPath, JSON.stringify(budget, null, 2));
    
    console.log('📋 Performance budget created at performance-budget.json');
    return budget;
  }

  async checkLighthouseScores() {
    console.log('\n🔍 Lighthouse Score Targets');
    console.log('============================');
    
    const targets = {
      performance: 90,
      accessibility: 95,
      bestPractices: 90,
      seo: 90,
      pwa: 80
    };

    Object.entries(targets).forEach(([category, score]) => {
      console.log(`${category}: ${score}+`);
    });

    console.log('\nRun "npm run lighthouse" to check actual scores');
  }

  generateOptimizationTips() {
    console.log('\n💡 Performance Optimization Tips');
    console.log('=================================');
    
    const tips = [
      '📦 Use dynamic imports for route-based code splitting',
      '🖼️  Implement lazy loading for images below the fold',
      '⚡ Enable preload for critical resources',
      '🗜️  Compress images and use modern formats (WebP, AVIF)',
      '📱 Implement virtual scrolling for large lists',
      '🔄 Use service worker for aggressive caching',
      '⏱️  Minimize main thread blocking with Web Workers',
      '🎯 Implement resource hints (prefetch, preload, preconnect)',
      '📊 Monitor Core Web Vitals in production',
      '🧹 Remove unused CSS and JavaScript',
      '🔀 Use HTTP/2 server push for critical resources',
      '📦 Implement tree shaking to reduce bundle size'
    ];

    tips.forEach(tip => console.log(tip));
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async run() {
    console.log('🚀 Family Budget - Performance Monitor');
    console.log('======================================\n');

    try {
      await this.analyzeBundleSize();
      this.generatePerformanceBudget();
      await this.checkLighthouseScores();
      this.generateOptimizationTips();
      
      console.log('\n✅ Performance analysis complete!');
      console.log('\nNext steps:');
      console.log('1. Run "npm run build" to build the app');
      console.log('2. Run "npm run lighthouse" to run Lighthouse audit');
      console.log('3. Monitor bundle sizes after adding new features');
      console.log('4. Test PWA functionality in DevTools');
      
    } catch (error) {
      console.error('❌ Performance monitoring failed:', error);
      process.exit(1);
    }
  }
}

// Run the performance monitor
const monitor = new PerformanceMonitor();
monitor.run();