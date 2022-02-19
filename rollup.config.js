const preventThreeShakingPlugin = () => {
  return {
    name: 'no-threeshaking',
    resolveId(id, importer) {
      if (!importer) {
        // let's not theeshake entry points, as we're not exporting anything in Apps Script files
        return { id, moduleSideEffects: 'no-treeshake' }
      }
      return null
    },
  }
}

export default [
  {
    input: '/home/ikeni/Documents/Git/familyBudget/src/portfolio/standalone.js',
    output: {
      dir:
        '/home/ikeni/Documents/Git/familyBudget/portfolio/portfolioLib/build',
      format: 'es',
    },
    plugins: [preventThreeShakingPlugin()],
  },
  {
    input: '/home/ikeni/Documents/Git/familyBudget/src/portfolio/bound.js',
    output: [
      {
        dir:
          '/home/ikeni/Documents/Git/familyBudget/portfolio/portfolioDev/build',
        format: 'es',
      },
      {
        dir:
          '/home/ikeni/Documents/Git/familyBudget/portfolio/portfolioProd/build',
        format: 'es',
      },
    ],
    plugins: [preventThreeShakingPlugin()],
  },
]
