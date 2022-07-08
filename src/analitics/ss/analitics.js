import { Environment, WorkSheet } from '../../gas'
import { Header } from '../../header'
export { Analitics }

new Environment([
  {
    spreadSheetName: 'analitics',
    sheetId: '10QgekcQTxaUi22eef9QPefk9JK7OjQwhlMBlkD7bCeg',
    scriptId: '1ht5DfnNxdP_qCUP1eM78UY_IsIr7PpcD63fDAX3X0x5Q-XccrzP0Zq35',
    area: 'prod',
  },
])

class Analitics {
  constructor() {
    if (Analitics.exists) {
      return Analitics.instance
    }
    Analitics.instance = this
    Analitics.exists = true
    this.workSheetHeads = {
      history: {
        type: 'tx',
        rowNum: 1,
        columns: {
          dateKey: { alias: 'dateKey', idx: 0 },
          date: { alias: 'date', idx: 1 },
          dateUnix: { alias: 'dateUnix', idx: 2 },
          tokenATokenB: { alias: 'tokenATokenB', idx: 3 },
          tokenAPrice: { alias: 'tokenAPrice', idx: 4 },
          tokenBPrice: { alias: 'tokenBPrice', idx: 5 },
          coefPrice: { alias: 'coefPrice', idx: 6 },
          lrCoefPrice: { alias: 'lrCoefPrice', idx: 7 },
          lrCoefPriceHigh: { alias: 'lrCoefPriceHigh', idx: 8 },
          lrCoefPriceLow: { alias: 'lrCoefPriceLow', idx: 9 },
          stdevPositiveArraydiffCoefPricestoLr: {
            alias: 'stdevPositiveArraydiffCoefPricestoLr',
            idx: 10,
          },
          varPositiveArraydiffCoefPricestoLr: {
            alias: 'varPositiveArraydiffCoefPricestoLr',
            idx: 11,
          },
          avgPositiveArraydiffCoefPricestoLr: {
            alias: 'avgPositiveArraydiffCoefPricestoLr',
            idx: 12,
          },
          coefVarPositiveArraydiffCoefPricestoLr: {
            alias: 'coefVarPositiveArraydiffCoefPricestoLr',
            idx: 13,
          },
          stdevNegativeArraydiffCoefPricestoLr: {
            alias: 'stdevNegativeArraydiffCoefPricestoLr',
            idx: 14,
          },
          varNegativeArraydiffCoefPricestoLr: {
            alias: 'varNegativeArraydiffCoefPricestoLr',
            idx: 15,
          },
          avgNegativeArraydiffCoefPricestoLr: {
            alias: 'avgNegativeArraydiffCoefPricestoLr',
            idx: 16,
          },
          coefVarNegativeArraydiffCoefPricestoLr: {
            alias: 'coefVarNegativeArraydiffCoefPricestoLr',
            idx: 17,
          },
          tokenAMarketCap: { alias: 'tokenAMarketCap', idx: 18 },
          tokenBMarketCap: { alias: 'tokenBMarketCap', idx: 19 },
          coefPriceMarketCap: { alias: 'coefPriceMarketCap', idx: 20 },
          lrCoefPriceMarketCap: { alias: 'lrCoefPriceMarketCap', idx: 21 },
          tokenAVolume: { alias: 'tokenAVolume', idx: 22 },
          tokenBVolume: { alias: 'tokenBVolume', idx: 23 },
          coefVolume: { alias: 'coefVolume', idx: 24 },
          lrCoefVolume: { alias: 'lrCoefVolume', idx: 25 },
          tokenAVolatility: { alias: 'tokenAVolatility', idx: 26 },
          tokenBVolatility: { alias: 'tokenBVolatility', idx: 27 },
          coefVolatility: { alias: 'coefVolatility', idx: 28 },
          lrCoefVolatility: { alias: 'lrCoefVolatility', idx: 29 },
          rowId: { alias: 'Row ID', idx: 30 },
        },
      },
    }
    this.spreadSheetName = 'analitics'
  }

  getWorkSheet(sheetName) {
    try {
      let headSheetName
      headSheetName = sheetName
      const head = new Header().getHead(this.workSheetHeads, headSheetName)
      const workSheet = new WorkSheet(
        this.spreadSheetName,
        sheetName,
        head
      ).getDataset()
      return workSheet
    } catch (error) {
      console.error('Analitics.getWorkSheet', error.stack)
    }
  }
}

// Deprecated
// flowSymbol: {
//   type: 'tx',
//   rowNum: 1,
//   columns: {
//     account: { alias: 'Account', idx: 0 },
//     symbol: { alias: 'Symbol', idx: 1 },
//     symbolKey: { alias: 'Symbol key', idx: 2 },
//     quantityOwnInFlow: { alias: 'Quantity own in flow', idx: 3 },
//     quantityInFlow: { alias: 'Quantity in flow', idx: 4 },
//     quantityOutFlow: { alias: 'Quantity out flow', idx: 5 },
//     quantityRest: { alias: 'Quantity rest', idx: 6 },
//     quantityRestLock: { alias: 'Quantity rest lock', idx: 7 },
//     quantityRestUnlock: { alias: 'Quantity rest unlock', idx: 8 },
//     priceOwnInFlow: { alias: 'Price own in flow', idx: 9 },
//     priceInFlow: { alias: 'Price in flow', idx: 10 },
//     priceOutFlow: { alias: 'Price out flow', idx: 11 },
//     priceRest: { alias: 'Price rest', idx: 12 },
//     costOwnInFlow: { alias: 'Cost own in flow', idx: 13 },
//     costInFlow: { alias: 'Cost in flow', idx: 14 },
//     costOutFlow: { alias: 'Cost out flow', idx: 15 },
//     costRest: { alias: 'Cost rest', idx: 16 },
//     costRestInFlow: { alias: 'Cost rest in flow', idx: 17 },
//     costRestLock: { alias: 'Cost rest lock', idx: 18 },
//     costRestUnlock: { alias: 'Cost rest unlock', idx: 19 },
//     pnlTotal: { alias: 'PnL total', idx: 20 },
//     pnlRest: { alias: 'PnL rest', idx: 21 },
//     payback: { alias: 'Payback', idx: 22 },
//     dayInPortfolioAvg: {
//       alias: 'Day in Portfolio (avg)',
//       idx: 23,
//     },
//     update: {
//       alias: 'Update',
//       idx: 24,
//       type: 'date',
//       default: new Date(),
//     },
//   },
// },
