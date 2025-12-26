// PostCSS configuration for CSS minification
// Used by minify.sh via postcss-cli
//
// Updated 2025-12-26: Advanced cssnano preset for better compression
// Expected additional reduction: 5-15% over default preset

module.exports = {
  plugins: {
    cssnano: {
      preset: ['advanced', {
        discardComments: {
          removeAll: true,
        },
        reduceIdents: true,
        mergeIdents: true,
        mergeLonghand: true,
        mergeRules: true,
        cssDeclarationSorter: true,
        calc: true,
        colormin: true,
        convertValues: true,
        discardDuplicates: true,
        discardEmpty: true,
        discardOverridden: true,
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
        zindex: false,  // Don't modify z-index values for safety
      }],
    },
  },
};
