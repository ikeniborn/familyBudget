import { Environment, WorkSheet, WorkSheetRange } from '../../gas'
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
      overflowList: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'rowKey', idx: 0 },
          tokenAId: {
            alias: 'tokenAId',
            pk: true,
            notNull: true,
            idx: 1,
          },
          tokenBId: {
            alias: 'tokenBId',
            pk: true,
            notNull: true,
            idx: 2,
          },

          dateFrom: { alias: 'dateFrom', idx: 5 },
          dateTo: { alias: 'dateTo', idx: 6 },
          lrCoefPriceSlope: { alias: 'lrCoefPriceSlope', idx: 7 },
          lrCoefPriceIntercept: { alias: 'lrCoefPriceIntercept', idx: 8 },
          lrCoefPriceR2: { alias: 'lrCoefPriceR2', idx: 7 },
          lrCoefPriceHighSlope: { alias: 'lrCoefPriceHighSlope', idx: 9 },
          lrCoefPriceHighIntercept: {
            alias: 'lrCoefPriceHighIntercept',
            idx: 10,
          },
          lrCoefPriceHighR2: { alias: 'lrCoefPriceHighR2', idx: 7 },
          lrCoefPriceLowSlope: { alias: 'lrCoefPriceLowSlope', idx: 11 },
          lrCoefPriceLowIntercept: {
            alias: 'lrCoefPriceLowIntercept',
            idx: 12,
          },
          lrCoefPriceLowR2: { alias: 'lrCoefPriceLowR2', idx: 7 },
          isValideChannel: {
            alias: 'isValideChannel',
            idx: 13,
          },
          updateDate: {
            alias: 'Update date',
            idx: 14,
            type: 'date',
            default: new Date(),
          },
        },
      },
      history: {
        type: 'tx',
        rowNum: 1,
        columns: {
          dateKey: { alias: 'dateKey', idx: 0 },
          date: { alias: 'date', idx: 1 },
          dateUnix: { alias: 'dateUnix', idx: 2 },
          dateValue: { alias: 'dateValue', idx: 3 },
          tokenATokenB: { alias: 'tokenATokenB', idx: 4 },
          tokenATokenBKey: { alias: 'tokenATokenBKey', idx: 5 },
          tokenAPrice: { alias: 'tokenAPrice', idx: 6 },
          tokenBPrice: { alias: 'tokenBPrice', idx: 7 },
          coefPrice: { alias: 'coefPrice', idx: 8 },
          coefPriceAth: { alias: 'coefPriceAth', idx: 9 },
          coefPriceAtl: { alias: 'coefPriceAtl', idx: 10 },
          lrCoefPrice: { alias: 'lrCoefPrice', idx: 11 },
          lrCoefPriceHigh: { alias: 'lrCoefPriceHigh', idx: 12 },
          lrCoefPriceLow: { alias: 'lrCoefPriceLow', idx: 13 },
          // lrCoefPrice3d: { alias: 'lrCoefPrice3d', idx: 14 },
          // lrCoefPriceHigh3d: { alias: 'lrCoefPriceHigh3d', idx: 15 },
          // lrCoefPriceLow3d: { alias: 'lrCoefPriceLow3d', idx: 16 },
          // lrCoefPrice7d: { alias: 'lrCoefPrice7d', idx: 17 },
          // lrCoefPriceHigh7d: { alias: 'lrCoefPriceHigh7d', idx: 18 },
          // lrCoefPriceLow7d: { alias: 'lrCoefPriceLow7d', idx: 19 },

          lrCoefPrice30d: { alias: 'lrCoefPrice30d', idx: 14 },
          lrCoefPriceHigh30d: { alias: 'lrCoefPriceHigh30d', idx: 15 },
          lrCoefPriceLow30d: { alias: 'lrCoefPriceLow30d', idx: 16 },
          lrCoefPrice60d: { alias: 'lrCoefPrice60d', idx: 17 },
          lrCoefPriceHigh60d: { alias: 'lrCoefPriceHigh60d', idx: 18 },
          lrCoefPriceLow60d: { alias: 'lrCoefPriceLow60d', idx: 19 },
          lrCoefPrice90d: { alias: 'lrCoefPrice90d', idx: 20 },
          lrCoefPriceHigh90d: { alias: 'lrCoefPriceHigh90d', idx: 21 },
          lrCoefPriceLow90d: { alias: 'lrCoefPriceLow90d', idx: 22 },
          // stdevPositiveArraydiffCoefPricestoLr: {
          //   alias: 'stdevPositiveArraydiffCoefPricestoLr',
          //   idx: 10,
          // },
          // varPositiveArraydiffCoefPricestoLr: {
          //   alias: 'varPositiveArraydiffCoefPricestoLr',
          //   idx: 11,
          // },
          // avgPositiveArraydiffCoefPricestoLr: {
          //   alias: 'avgPositiveArraydiffCoefPricestoLr',
          //   idx: 12,
          // },
          // coefVarPositiveArraydiffCoefPricestoLr: {
          //   alias: 'coefVarPositiveArraydiffCoefPricestoLr',
          //   idx: 13,
          // },
          // stdevNegativeArraydiffCoefPricestoLr: {
          //   alias: 'stdevNegativeArraydiffCoefPricestoLr',
          //   idx: 14,
          // },
          // varNegativeArraydiffCoefPricestoLr: {
          //   alias: 'varNegativeArraydiffCoefPricestoLr',
          //   idx: 15,
          // },
          // avgNegativeArraydiffCoefPricestoLr: {
          //   alias: 'avgNegativeArraydiffCoefPricestoLr',
          //   idx: 16,
          // },
          // coefVarNegativeArraydiffCoefPricestoLr: {
          //   alias: 'coefVarNegativeArraydiffCoefPricestoLr',
          //   idx: 17,
          // },
          // tokenAMarketCap: { alias: 'tokenAMarketCap', idx: 18 },
          // tokenBMarketCap: { alias: 'tokenBMarketCap', idx: 19 },
          // coefPriceMarketCap: { alias: 'coefPriceMarketCap', idx: 20 },
          // lrCoefPriceMarketCap: { alias: 'lrCoefPriceMarketCap', idx: 21 },
          // tokenAVolume: { alias: 'tokenAVolume', idx: 22 },
          // tokenBVolume: { alias: 'tokenBVolume', idx: 23 },
          // coefVolume: { alias: 'coefVolume', idx: 24 },
          // lrCoefVolume: { alias: 'lrCoefVolume', idx: 25 },
          // tokenAVolatility: { alias: 'tokenAVolatility', idx: 26 },
          // tokenBVolatility: { alias: 'tokenBVolatility', idx: 27 },
          // coefVolatility: { alias: 'coefVolatility', idx: 28 },
          // lrCoefVolatility: { alias: 'lrCoefVolatility', idx: 29 },
          rowId: { alias: 'Row ID', idx: 25 },
        },
      },
      tokenList: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          symbol: { alias: 'Symbol', idx: 1, pk: true, notNull: true },
          coinGeckoId: { alias: 'coinGecko id', idx: 2 },
          cryptoCompareId: { alias: 'CryptoCompare id', idx: 3 },
          coinMarketMapId: { alias: 'CoinMarketCap id', idx: 4 },
          cryptoRankId: { alias: 'CryptoRank id', idx: 5 },
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

  updateOnEdit(range) {
    try {
      let sheetName, headSheetName, isRegistry
      sheetName = range.getSheet().getSheetName()
      headSheetName = sheetName

      const head = new Header().getHead(this.workSheetHeads, headSheetName)
      const workSheet = new WorkSheetRange(
        this.spreadSheetName,
        sheetName,
        head,
        range
      ).getDataset()

      return workSheet
    } catch (error) {
      console.error('Portfolio.updateOnEdit', error.stack)
    }
  }
}
