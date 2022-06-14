import { Environment } from '../../gas'
import { Header } from '../../header'
import { FormatDate } from '../../utils'
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
          accountSender: { alias: 'Account sender', idx: 1, notNull: true },
          accountRecipient: { alias: 'Account recipient', idx: 2 },
          platform: { alias: 'Platform', idx: 3, notNull: true },
          service: { alias: 'Service', idx: 4, notNull: true },
          sender: { alias: 'Sender', idx: 5, notNull: true },
          recipient: { alias: 'Recipient', idx: 6 },
          lockStatus: { alias: 'Lock status', idx: 7 },
          coin: { alias: 'Coin', idx: 8, notNull: true },
          coinQty: { alias: 'Coin, qty', idx: 9 },
          currency: { alias: 'Currency', idx: 10 },
          currencyQty: { alias: 'Currency, qty', idx: 11 },
          currencyPerCoin: { alias: 'Currency per coin', idx: 12 },
          feeSender: { alias: 'Fee sender', idx: 13 },
          feeCurrency: { alias: 'Fee currency', idx: 14 },
          feeQty: { alias: 'Fee, qty', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          date: {
            alias: 'Date',
            idx: 17,
            notNull: true,
            type: 'date',
            default: void 0,
          },
          time: { alias: 'Time', idx: 18, notNull: true },
          isDelete: { alias: 'Is delete', idx: 19 },
          dateSaved: {
            alias: 'Date saved',
            idx: 20,
            type: 'date',
            default: new Date(),
          },
          timeSpent: {
            alias: 'Time spent (hh:mm:ss.ms)',
            idx: 21,
            type: 'string',
          },
          rowId: { alias: 'Row ID', idx: 22 },
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
          ecosystem: {
            alias: 'Ecosystem',
            idx: 5,
          },
          marketCapGroup: {
            alias: 'MarketCap group',
            idx: 6,
          },
          priceGroup: {
            alias: 'Price group',
            idx: 7,
          },
          sourceId: { alias: 'Source id', idx: 8 },
          price: { alias: 'Price', idx: 9 },
          useInReport: { alias: 'Use in report', idx: 10 },
          update: {
            alias: 'Update',
            idx: 11,
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
          sourceKey: { alias: 'Source key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          sourceName: { alias: 'Source name', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          account: { alias: 'Account', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          mainSymbol: { alias: 'Main coin', idx: 11 },
          symbol: { alias: 'Coin', idx: 12 },
          quantity: { alias: 'Quantity', idx: 13 },
          price: { alias: 'Price', idx: 14 },
          cost: { alias: 'Cost', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          isDelete: { alias: 'Delete', idx: 17 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 18 },
          isFee: { alias: 'Is fee', idx: 19 },
          isLock: { alias: 'Is lock', idx: 20 },
          isAvgPrice: { alias: 'Is average price', idx: 21 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 22,
          },
          registryRowId: { alias: 'Registry row id', idx: 23 },
          registryRowKey: { alias: 'Registry row key', idx: 24 },
          updateDate: {
            alias: 'Update date',
            idx: 25,
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
          sourceKey: { alias: 'Source key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          sourceName: { alias: 'Source name', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          account: { alias: 'Account', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          mainSymbol: { alias: 'Main coin', idx: 11 },
          symbol: { alias: 'Coin', idx: 12 },
          quantity: { alias: 'Quantity', idx: 13 },
          price: { alias: 'Price', idx: 14 },
          cost: { alias: 'Cost', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          isDelete: { alias: 'Delete', idx: 17 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 18 },
          isFee: { alias: 'Is fee', idx: 19 },
          isLock: { alias: 'Is lock', idx: 20 },
          isAvgPrice: { alias: 'Is average price', idx: 21 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 22,
          },
          registryRowId: { alias: 'Registry row id', idx: 23 },
          registryRowKey: { alias: 'Registry row key', idx: 24 },
          updateDate: {
            alias: 'Update date',
            idx: 25,
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
          mainAccount: { alias: 'Main account', idx: 0 },
          account: { alias: 'Account', idx: 1 },
          contractor: { alias: 'Contractor', idx: 2 },
          contractorType: { alias: 'Contractor type', idx: 3 },
          contractorCategory: { alias: 'Contractor category', idx: 4 },
          symbol: { alias: 'Symbol name', idx: 5 },
          symbolFullName: { alias: 'Symbol full name', idx: 6 },
          symbolCategory: { alias: 'Symbol category', idx: 7 },
          symbolEcosystem: { alias: 'Symbol ecosystem', idx: 8 },
          symbolMarketCapGroup: { alias: 'Symbol marketcap group', idx: 9 },
          quantityOwnInFlow: { alias: 'Quantity (own in flow)', idx: 10 },
          quantityInFlow: { alias: 'Quantity (in flow)', idx: 11 },
          quantityOutFlow: { alias: 'Quantity (out flow)', idx: 12 },
          quantityFlow: { alias: 'Quantity (flow)', idx: 13 },
          quantityLock: { alias: 'Quantity (lock)', idx: 14 },
          quantityUnlock: { alias: 'Quantity (unlock)', idx: 15 },
          priceOwnInFlow: { alias: 'Price (own in flow), $', idx: 16 },
          priceInFlow: { alias: 'Price (in flow), $', idx: 17 },
          priceOutFlow: { alias: 'Price (out flow), $', idx: 18 },
          priceFlow: { alias: 'Price (flow), $', idx: 19 },
          price: { alias: 'Price, $', idx: 20 },
          costOwnInFlow: { alias: 'Cost (own in flow), $', idx: 21 },
          costInFlow: { alias: 'Cost (in flow), $', idx: 22 },
          costOutFlow: { alias: 'Cost (out flow), $', idx: 23 },
          costFlow: { alias: 'Cost (flow), $', idx: 24 },
          cost: { alias: 'Cost, $', idx: 25 },
          costLock: { alias: 'Cost (lock), $', idx: 26 },
          costUnlock: { alias: 'Cost (unlock), $', idx: 27 },
          pnlFlow: { alias: 'PnL (flow), $', idx: 28 },
          pnlTotal: { alias: 'PnL (total), $', idx: 29 },
          payback: { alias: 'Payback, $', idx: 30 },
          quantityRebalance: { alias: 'Rebalance, qty', idx: 31 },
          dayInPortfolioAvg: {
            alias: 'Average day in portfolio',
            idx: 32,
          },
          isSell: { alias: 'Is sell', idx: 33, default: false },
          useInReport: { alias: 'Use in report', idx: 34 },
          updateDataMart: {
            alias: 'Update data mart',
            idx: 35,
            type: 'date',
          },
          updateDataMartKey: {
            alias: 'Update data mart key',
            idx: 36,
          },
          actualDataMart: {
            alias: 'Actual data mart',
            idx: 37,
          },
          rowId: { alias: 'Row ID', idx: 38, default: 0 },
          symbolPriceGroup: { alias: 'Symbol price group', idx: 39 },
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
      accounts: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          mainAccount: { alias: 'Main account', idx: 2, notNull: true },
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
          mainSymbol: { alias: 'Main symbol', pk: true, idx: 2, notNull: true },
          mainSymbolQty: {
            alias: 'Main symbol qty',
            idx: 3,
          },
          mainSymbolHistoricalCost: {
            alias: 'Main symbol historical cost',
            idx: 4,
          },
          mainSymbolHistoricalPrice: {
            alias: 'Main symbol historical price',
            idx: 5,
          },
          pairOneSymbol: { alias: 'Pair one symbol', idx: 6 },
          pairOneQty: { alias: 'Pair one qty', idx: 7 },
          pairOnePrice: { alias: 'Pair one price', idx: 8 },
          pairTwoSymbol: { alias: 'Pair one symbol', idx: 9 },
          pairTwoQty: { alias: 'Pair two qty', idx: 10 },
          pairTwoPrice: { alias: 'Pair two price', idx: 11 },
          pairThreeSymbol: { alias: 'Pair three symbol', idx: 12 },
          pairThreeQty: { alias: 'Pair three qty', idx: 13 },
          pairThreePrice: { alias: 'Pair three price', idx: 14 },
          update: {
            alias: 'Update',
            idx: 15,
            type: 'date',
            default: new Date(),
          },
        },
      },
    }
    this.spreadSheetName = 'portfolio'
    this.log = new Log(this.spreadSheetName)
  }

  getWorkSheet(sheetName) {
    try {
      let headSheetName, isRegistry
      headSheetName = sheetName
      isRegistry = false
      if (sheetName.match('Registry')) {
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
      if (sheetName.match('Registry')) {
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
