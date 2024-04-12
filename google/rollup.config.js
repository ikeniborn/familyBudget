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
    input: '/home/ikeni/Documents/Git/familyBudget/google/src/portfolio/script.js',
    output: [
      {
        dir:
          '/home/ikeni/Documents/Git/familyBudget/google/build/dev/build',
        format: 'es',
      },
      {
        dir:
          '/home/ikeni/Documents/Git/familyBudget/google/build/prod/build',
        format: 'es',
      },
    ],
    plugins: [preventThreeShakingPlugin()],
  },
  // {
  //   input: '/home/ikeni/Documents/Git/familyBudget/src/budget/script.js',
  //   output: [
  //     {
  //       dir: '/home/ikeni/Documents/Git/familyBudget/budget/budgetDev/build',
  //       format: 'es',
  //     },
  //     {
  //       dir: '/home/ikeni/Documents/Git/familyBudget/budget/budgetProd/build',
  //       format: 'es',
  //     },
  //   ],
  //   plugins: [preventThreeShakingPlugin()],
  // },
  // {
  //   input: '/home/ikeni/Documents/Git/familyBudget/src/analitics/script.js',
  //   output: [
  //     {
  //       dir: '/home/ikeni/Documents/Git/familyBudget/analitics/build',
  //       format: 'es',
  //     },
  //   ],
  //   plugins: [preventThreeShakingPlugin()],
  // },
]
