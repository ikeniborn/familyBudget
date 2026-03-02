#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const VENDOR_JS_DIR = path.join(__dirname, '..', 'frontend', 'web', 'static', 'js', 'vendor');
const VENDOR_CSS_DIR = path.join(__dirname, '..', 'frontend', 'web', 'static', 'css');
const STATIC_JS_DIR = path.join(__dirname, '..', 'frontend', 'web', 'static', 'js');

const JS_FILES = [
  'htmx.js',
  'choices.js',
  'echarts.js',
  'qr-creator.js',
  'jsqr.js',
];

// Standalone JS files (not in vendor directory)
const STANDALONE_JS_FILES = [
  'admin-facts-common.js'
];

const CSS_FILES = [
  {
    input: path.join(VENDOR_CSS_DIR, 'loading-dots.css'),
    output: path.join(VENDOR_CSS_DIR, 'loading-dots.min.css')
  }
];

/**
 * Minify a single vendor JS file using terser
 * @param {string} filename - Name of the JS file to minify
 * @param {string} [baseDir=VENDOR_JS_DIR] - Base directory for the file
 * @returns {Promise<void>}
 */
function minifyFile(filename, baseDir = VENDOR_JS_DIR) {
  const input = path.join(baseDir, filename);
  const output = path.join(baseDir, filename.replace('.js', '.min.js'));

  return new Promise((resolve, reject) => {
    console.log(`📦 Minifying ${filename}...`);

    try {
      // Check if source file exists
      if (!fs.existsSync(input)) {
        reject(new Error(`Source file not found: ${input}`));
        return;
      }

      // Run terser with compression and mangling
      execSync(`npx terser ${input} -o ${output} --compress --mangle`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });

      // Verify output was created
      if (!fs.existsSync(output)) {
        reject(new Error(`Failed to create output: ${output}`));
        return;
      }

      // Get file sizes for reporting
      const inputSize = fs.statSync(input).size;
      const outputSize = fs.statSync(output).size;
      const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);

      console.log(`✅ ${filename} → ${filename.replace('.js', '.min.js')} (${reduction}% smaller)`);
      resolve();
    } catch (error) {
      console.error(`❌ Failed to minify ${filename}:`, error.message);
      reject(error);
    }
  });
}

/**
 * Minify a single CSS file using PostCSS + cssnano
 * @param {{input: string, output: string}} fileConfig - Input and output paths
 * @returns {Promise<void>}
 */
function minifyCSS(fileConfig) {
  const { input, output } = fileConfig;

  return new Promise((resolve, reject) => {
    const filename = path.basename(input);
    console.log(`🎨 Minifying ${filename}...`);

    try {
      // Check if source file exists
      if (!fs.existsSync(input)) {
        reject(new Error(`Source file not found: ${input}`));
        return;
      }

      // Run postcss with cssnano plugin
      execSync(`npx postcss ${input} -o ${output} -u cssnano`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });

      // Verify output was created
      if (!fs.existsSync(output)) {
        reject(new Error(`Failed to create output: ${output}`));
        return;
      }

      // Get file sizes for reporting
      const inputSize = fs.statSync(input).size;
      const outputSize = fs.statSync(output).size;
      const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);

      console.log(`✅ ${filename} → ${path.basename(output)} (${reduction}% smaller)`);
      resolve();
    } catch (error) {
      console.error(`❌ Failed to minify ${filename}:`, error.message);
      reject(error);
    }
  });
}

/**
 * Main function - minify all vendor JS and CSS files in parallel
 */
async function main() {
  console.log('🚀 Starting parallel vendor + standalone minification...\n');

  try {
    // Execute all minification tasks in parallel (JS + CSS + standalone)
    await Promise.all([
      ...JS_FILES.map(file => minifyFile(file, VENDOR_JS_DIR)),
      ...STANDALONE_JS_FILES.map(file => minifyFile(file, STATIC_JS_DIR)),
      ...CSS_FILES.map(fileConfig => minifyCSS(fileConfig))
    ]);

    console.log('\n✨ All files minified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Minification failed:', error.message);
    process.exit(1);
  }
}

main();
