import { Environment } from '../../gas'
import { Header } from '../../header'
import { FormatDate, Hash } from '../../utils'
import { WorkSheet, WorkSheetRange } from '../../gas'
import { Log } from '../../log'
export { Portfolio }

new Environment([
  {
    spreadSheetName: 'portfolio',
    sheetId: '1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1iGoWj5YHB_iQi7o09-vJF6XJeveFI54lLOlx193Y0f8',
    scriptId: '19LYhtfrshQkWLvGQedmXFG4XJkcOR3cO9-E6Ne32GmKT766phfg71J_d',
    area: 'dev',
  },
])

class Portfolio {
  constructor() {
    if (Portfolio.exists) {
      return Portfolio.instance
    }
    Portfolio.instance = this
    Portfolio.exists = true
    this.workSheetHeads = {
      registry: {
        type: 'tx',
        rowNum: 1,
        columns: {
          operation: { alias: 'Operation', idx: 0, notNull: true },
          portfolioSender: { alias: 'Portfolio (out)', idx: 1, notNull: true },
          accountRecipient: { alias: 'Account (in)', idx: 2 },
          portfolioRecipient: { alias: 'Portfolio (in)', idx: 3 },
          platform: { alias: 'Platform', idx: 4, notNull: true },
          service: { alias: 'Service', idx: 5, notNull: true },
          sender: { alias: 'Sender (out)', idx: 6, notNull: true },
          recipient: { alias: 'Recipient (in)', idx: 7 },
          lockStatus: { alias: 'Lock status', idx: 8 },
          coin: { alias: 'Coin', idx: 9, notNull: true },
          coinQty: { alias: 'Coin, qty', idx: 10 },
          currency: { alias: 'Currency', idx: 11 },
          currencyQty: { alias: 'Currency, qty', idx: 12 },
          currencyPerCoin: { alias: 'Currency per coin', idx: 13 },
          feeSender: { alias: 'Fee sender (out)', idx: 14 },
          feeCurrency: { alias: 'Fee currency', idx: 15 },
          feeQty: { alias: 'Fee, qty', idx: 16 },
          comment: { alias: 'Comment', idx: 17 },
          date: {
            alias: 'Date',
            idx: 18,
            notNull: true,
            type: 'date',
            default: void 0,
          },
          time: { alias: 'Time', idx: 19, notNull: true },
          isDelete: { alias: 'Is delete', idx: 20 },
          dateSaved: {
            alias: 'Date saved',
            idx: 21,
            type: 'date',
            default: new Date(),
          },
          timeSpent: {
            alias: 'Time spent (hh:mm:ss.ms)',
            idx: 22,
            type: 'string',
          },
          rowId: { alias: 'Row ID', idx: 23 },
        },
      },
      symbols: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: {
            alias: 'Source',
            idx: 1,
            notNull: true,
          },
          name: {
            alias: 'Full name',
            idx: 2,
            notNull: true,
          },
          symbol: {
            alias: 'Symbol',
            pk: true,
            idx: 3,
            notNull: true,
          },
          symbolCategory: {
            alias: 'Symbol category ',
            idx: 4,
            notNull: true,
          },
          sourceId: { alias: 'Source id', idx: 5 },
          price: { alias: 'Price', idx: 6 },
          useInReport: { alias: 'Use in report', idx: 7 },
          update: {
            alias: 'Update',
            idx: 8,
            type: 'date',
            default: new Date(),
          },
        },
      },
      transactions: {
        type: 'fct',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          accountKey: { alias: 'Account key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          account: { alias: 'Account', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          portfolio: { alias: 'Portfolio', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          overflow: { alias: 'Overflow', idx: 11 },
          overflowRev: { alias: 'Overflow rev', idx: 12 },
          mainSymbol: { alias: 'Main coin', idx: 13 },
          symbol: { alias: 'Coin', idx: 14 },
          quantity: { alias: 'Quantity', idx: 15 },
          price: { alias: 'Price', idx: 16 },
          priceCoef: { alias: 'Price coef', idx: 17 },
          priceCoefRev: { alias: 'Price coef rev', idx: 18 },
          cost: { alias: 'Cost', idx: 19 },
          priceBTC: { alias: 'Price BTC', idx: 20 },
          costBTC: { alias: 'Cost BTC', idx: 21 },
          comment: { alias: 'Comment', idx: 22 },
          isDelete: { alias: 'Delete', idx: 23 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 24 },
          isFee: { alias: 'Is fee', idx: 25 },
          isLock: { alias: 'Is lock', idx: 26 },
          isAvgPrice: { alias: 'Is average price', idx: 27 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 28,
          },
          isOverflow: { alias: 'Is overflow', idx: 29 },
          registryRowId: { alias: 'Registry row id', idx: 30 },
          registryRowKey: { alias: 'Registry row key', idx: 301 },
          updateDate: {
            alias: 'Update date',
            idx: 32,
            type: 'date',
            default: new Date(),
          },
        },
      },
      deletedTransactions: {
        type: 'fct',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          accountKey: { alias: 'Account key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          account: { alias: 'Account', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          portfolio: { alias: 'Portfolio', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          overflow: { alias: 'Overflow', idx: 11 },
          overflowRev: { alias: 'Overflow rev', idx: 12 },
          mainSymbol: { alias: 'Main coin', idx: 13 },
          symbol: { alias: 'Coin', idx: 14 },
          quantity: { alias: 'Quantity', idx: 15 },
          price: { alias: 'Price', idx: 16 },
          priceCoef: { alias: 'Price coef', idx: 17 },
          priceCoefRev: { alias: 'Price coef rev', idx: 18 },
          cost: { alias: 'Cost', idx: 19 },
          priceBTC: { alias: 'Price BTC', idx: 20 },
          costBTC: { alias: 'Cost BTC', idx: 21 },
          comment: { alias: 'Comment', idx: 22 },
          isDelete: { alias: 'Delete', idx: 23 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 24 },
          isFee: { alias: 'Is fee', idx: 25 },
          isLock: { alias: 'Is lock', idx: 26 },
          isAvgPrice: { alias: 'Is average price', idx: 27 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 28,
          },
          isOverflow: { alias: 'Is overflow', idx: 29 },
          registryRowId: { alias: 'Registry row id', idx: 30 },
          registryRowKey: { alias: 'Registry row key', idx: 301 },
          updateDate: {
            alias: 'Update date',
            idx: 32,
            type: 'date',
            default: new Date(),
          },
          deleteDate: {
            alias: 'Delete date',
            idx: 26,
            type: 'date',
            default: new Date(),
          },
        },
      },
      flow: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          portfolio: { alias: 'Portfolio', idx: 1 },
          contractor: { alias: 'Contractor', idx: 2 },
          contractorType: { alias: 'Contractor type', idx: 3 },
          contractorCategory: { alias: 'Contractor category', idx: 4 },
          symbol: { alias: 'Symbol name', idx: 5 },
          symbolFullName: { alias: 'Symbol full name', idx: 6 },
          symbolCategory: { alias: 'Symbol category', idx: 7 },
          quantityOwnInFlow: { alias: 'Quantity (own in flow)', idx: 8 },
          quantityInFlow: { alias: 'Quantity (in flow)', idx: 9 },
          quantityOutFlow: { alias: 'Quantity (out flow)', idx: 10 },
          quantityFlow: { alias: 'Quantity (flow)', idx: 11 },
          quantityLock: { alias: 'Quantity (lock)', idx: 12 },
          quantityUnlock: { alias: 'Quantity (unlock)', idx: 13 },
          priceOwnInFlow: { alias: 'Price (own in flow), $', idx: 14 },
          priceInFlow: { alias: 'Price (in flow), $', idx: 15 },
          priceOutFlow: { alias: 'Price (out flow), $', idx: 16 },
          priceFlow: { alias: 'Price (flow), $', idx: 17 },
          price: { alias: 'Price, $', idx: 18 },
          costOwnInFlow: { alias: 'Cost (own in flow), $', idx: 19 },
          costInFlow: { alias: 'Cost (in flow), $', idx: 20 },
          costOutFlow: { alias: 'Cost (out flow), $', idx: 21 },
          costFlow: { alias: 'Cost (flow), $', idx: 22 },
          cost: { alias: 'Cost, $', idx: 23 },
          costLock: { alias: 'Cost (lock), $', idx: 24 },
          costUnlock: { alias: 'Cost (unlock), $', idx: 25 },
          pnlFlow: { alias: 'PnL (flow), $', idx: 26 },
          pnlTotal: { alias: 'PnL (total), $', idx: 27 },
          payback: { alias: 'Payback, $', idx: 28 },
          quantityRebalance: { alias: 'Rebalance, qty', idx: 29 },
          dayInPortfolioAvg: {
            alias: 'Average day in portfolio',
            idx: 30,
          },
          isSell: { alias: 'Is sell', idx: 31, default: false },
          useInReport: { alias: 'Use in report', idx: 32 },
          updateDataMart: {
            alias: 'Update data mart',
            idx: 33,
            type: 'date',
          },
          updateDataMartKey: {
            alias: 'Update data mart key',
            idx: 34,
          },
          actualDataMart: {
            alias: 'Actual data mart',
            idx: 35,
          },
          updateDate: {
            alias: 'Update date',
            idx: 36,
          },
          rowId: { alias: 'Row ID', idx: 37, default: 0 },
        },
      },
      overflows: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          dayInOverflowAvg: {
            alias: 'Day in overflow (avg)',
            idx: 1,
          },
          tokenA: { alias: 'Token A', idx: 2 },
          tokenARest: { alias: 'Token A rest', idx: 3 },
          tokenAQuantityFlow: { alias: 'Token A quantity flow', idx: 4 },
          tokenB: { alias: 'Token B', idx: 5 },
          tokenBRest: { alias: 'Token B rest', idx: 6 },
          tokenBQuantityFlow: { alias: 'Token B quantity flow', idx: 7 },
          tokenBCostFlow: { alias: 'Token B cost flow, $', idx: 8 },
          overflow: { alias: 'Overflow', idx: 9 },
          ABPriceCoefFlow: { alias: 'A/B price coef flow', idx: 10 },
          ABPriceCoef: { alias: 'A/B price coef', idx: 11 },
          ABPriceCoefDiffPct: { alias: 'A/B price coef diff, %', idx: 12 },
          backflow: { alias: 'Backflow', idx: 13 },
          BAPriceCoefFlow: { alias: 'B/A price coef flow', idx: 14 },
          BAPriceCoef: { alias: 'B/A price coef', idx: 15 },
          BAPriceCoefDiffPct: { alias: 'B/A price coef diff, %', idx: 16 },
          overflowStatus: { alias: 'Overflow status', idx: 17 },
          rowId: { alias: 'Row ID', idx: 18, default: 0 },
          updateDataMart: {
            alias: 'Update data mart',
            idx: 19,
            type: 'date',
          },
        },
      },
      coins: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: { alias: 'Source', pk: true, idx: 1, notNull: true },
          name: { alias: 'Name', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 3, notNull: true },
          id: { alias: 'Id', idx: 4 },
        },
      },
      sources: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      web3Space: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          source: { alias: 'Source', pk: true, idx: 1, notNull: true },
          name: { alias: 'Name', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 3, notNull: true },
          category: { alias: 'Category', idx: 4 },
        },
      },
      symbolCategory: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          nameRu: { alias: 'Name (ru)', idx: 2, notNull: true },
          share: { alias: 'Share, %', idx: 3 },
        },
      },
      proofType: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          description: { alias: 'Description', idx: 1 },
        },
      },
      services: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          nameRu: { alias: 'Name (ru)', idx: 2 },
        },
      },
      operations: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      ecosystem: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          proofType: { alias: 'Proof type', idx: 2, notNull: true },
          share: { alias: 'Share, %', idx: 3 },
        },
      },
      portfolios: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      portfolioStrategies: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          account: { alias: 'Account', pk: true, idx: 1, notNull: true },
          portfolio: { alias: 'portfolio', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'symbol', pk: true, idx: 3, notNull: true },
          share: { alias: 'Share, %', idx: 4 },
        },
      },
      accounts: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          telegramId: { alias: 'Telegram Id', idx: 3 },
        },
      },
      lockStatus: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      contractors: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          type: { alias: 'Type', idx: 2, notNull: true },
          category: { alias: 'Category', idx: 3, notNull: true },
        },
      },
      lptoken: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          account: { alias: 'Account', pk: true, idx: 1, notNull: true },
          portfolio: { alias: 'Portfolio', pk: true, idx: 2, notNull: true },
          mainSymbol: { alias: 'Main symbol', pk: true, idx: 3, notNull: true },
          mainSymbolQty: {
            alias: 'Main symbol qty',
            idx: 4,
          },
          mainSymbolHistoricalCost: {
            alias: 'Main symbol historical cost',
            idx: 5,
          },
          mainSymbolHistoricalPrice: {
            alias: 'Main symbol historical price',
            idx: 6,
          },
          pairOneSymbol: { alias: 'Pair one symbol', idx: 7 },
          pairOneQty: { alias: 'Pair one qty', idx: 8 },
          pairOnePrice: { alias: 'Pair one price', idx: 9 },
          pairTwoSymbol: { alias: 'Pair one symbol', idx: 10 },
          pairTwoQty: { alias: 'Pair two qty', idx: 11 },
          pairTwoPrice: { alias: 'Pair two price', idx: 12 },
          pairThreeSymbol: { alias: 'Pair three symbol', idx: 13 },
          pairThreeQty: { alias: 'Pair three qty', idx: 14 },
          pairThreePrice: { alias: 'Pair three price', idx: 15 },
          update: {
            alias: 'Update',
            idx: 16,
            type: 'date',
            default: new Date(),
          },
        },
      },
    }
    this.spreadSheetName = 'portfolio'
    this.log = new Log(this.spreadSheetName)
  }

  getAccountsKey() {
    const head = new Header().getHead(this.workSheetHeads, 'Accounts')
    const workSheet = new WorkSheet(
      this.spreadSheetName,
      'Accounts',
      head
    ).getDataset()
    return workSheet.arrayOfObject.map((rowObject) => rowObject.rowKey)
  }

  getWorkSheet(sheetName) {
    try {
      let headSheetName, isRegistry
      headSheetName = sheetName
      isRegistry = false
      const accountsKey = this.getAccountsKey()
      if (accountsKey.indexOf(new Hash(sheetName).md5) !== -1) {
        headSheetName = 'Registry'
        isRegistry = true
      }
      const head = new Header().getHead(this.workSheetHeads, headSheetName)
      const workSheet = new WorkSheet(
        this.spreadSheetName,
        sheetName,
        head
      ).getDataset()
      workSheet.isRegistry = isRegistry
      workSheet.log = this.log
      return workSheet
    } catch (error) {
      console.error('Portfolio.getWorkSheet', error.stack)
    }
  }

  updateOnEdit(range) {
    try {
      let sheetName, headSheetName, isRegistry
      sheetName = range.getSheet().getSheetName()
      headSheetName = sheetName
      isRegistry = false
      const accountsKey = this.getAccountsKey()
      if (accountsKey.indexOf(new Hash(sheetName).md5) !== -1) {
        headSheetName = 'Registry'
        isRegistry = true
      }
      const head = new Header().getHead(this.workSheetHeads, headSheetName)
      const workSheet = new WorkSheetRange(
        this.spreadSheetName,
        sheetName,
        head,
        range
      ).getDataset()
      workSheet.isRegistry = isRegistry
      workSheet.log = this.log
      return workSheet
    } catch (error) {
      console.error('Portfolio.updateOnEdit', error.stack)
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
