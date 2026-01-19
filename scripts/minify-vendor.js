#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const VENDOR_DIR = path.join(__dirname, '..', 'frontend', 'web', 'static', 'js', 'vendor');

const files = [
  'htmx.js',
  'choices.js',
  'echarts.js',
  'qr-creator.js'
];

/**
 * Minify a single vendor JS file using terser
 * @param {string} filename - Name of the JS file to minify
 * @returns {Promise<void>}
 */
function minifyFile(filename) {
  const input = path.join(VENDOR_DIR, filename);
  const output = path.join(VENDOR_DIR, filename.replace('.js', '.min.js'));

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
 * Main function - minify all vendor JS files in parallel
 */
async function main() {
  console.log('🚀 Starting parallel vendor JS minification...\n');

  try {
    // Execute all minification tasks in parallel
    await Promise.all(files.map(file => minifyFile(file)));

    console.log('\n✨ All vendor JS files minified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Minification failed:', error.message);
    process.exit(1);
  }
}

main();
