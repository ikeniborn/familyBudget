// PostCSS configuration for CSS minification
// Used by minify.sh via postcss-cli

module.exports = {
  plugins: {
    cssnano: {
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
      }],
    },
  },
};
