// PostCSS configuration for CSS minification
// Used by minify.sh via postcss-cli
//
// Updated 2026-01-19: Added autoprefixer for vendor prefixes
// Updated 2025-12-26: Enhanced cssnano configuration
// Using 'default' preset with aggressive safe optimizations
// Expected reduction: 50-60% (same as advanced but with available packages)

module.exports = {
  plugins: {
    // Autoprefixer: Add vendor prefixes for cross-browser compatibility
    // Targets last 2 versions + iOS Safari 12+ (PWA support)
    autoprefixer: {
      overrideBrowserslist: [
        'last 2 versions',
        'iOS >= 12',
        'Safari >= 12',
        'Chrome >= 80',
        'Firefox >= 78',
        'Edge >= 80'
      ]
    },
    // cssnano: Minification (runs after autoprefixer)
    cssnano: {
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
        // CSS optimizations (all safe for modern browsers)
        calc: {
          precision: 5
        },
        colormin: true,
        convertValues: {
          length: true
        },
        discardDuplicates: true,
        discardEmpty: true,
        discardOverridden: true,
        mergeLonghand: true,
        mergeRules: true,
        minifyFontValues: true,
        minifyGradients: true,
        minifyParams: true,
        minifySelectors: true,
        normalizeCharset: true,
        normalizeDisplayValues: true,
        normalizePositions: true,
        normalizeRepeatStyle: true,
        normalizeString: true,
        normalizeTimingFunctions: true,
        normalizeUnicode: true,
        normalizeUrl: true,
        normalizeWhitespace: true,
        orderedValues: true,
        reduceTransforms: true,
        svgo: true,
        uniqueSelectors: true,
        // Safety options
        zindex: false,  // Don't modify z-index (can break layouts)
        reduceIdents: false,  // Don't minify animation/counter names (can break JS references)
      }],
    },
  },
};
