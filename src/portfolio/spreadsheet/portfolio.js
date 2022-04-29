import { Environment } from '../../gas'
import { Header } from '../../header'
// import { FormatDate } from '../../utils'
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
          feeCurrency: { alias: 'Fee currency', idx: 13 },
          feeQty: { alias: 'Fee, qty', idx: 14 },
          comment: { alias: 'Comment', idx: 15 },
          date: { alias: 'Date', idx: 16, notNull: true, type: 'date' },
          time: { alias: 'Time', idx: 17, notNull: true },
          isDelete: { alias: 'Is delete', idx: 18 },
          rowStatus: {
            alias: 'Row status',
            idx: 19,
            type: 'date',
          },
        },
      },
      prices: {
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
          web3SpaceInterest: {
            alias: 'Web3Space interest',
            idx: 7,
          },
          sourceId: { alias: 'Source id', idx: 8 },
          price: { alias: 'Price', idx: 9 },
          update: {
            alias: 'Update',
            idx: 10,
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
          registryRowNum: { alias: 'Registry row num', idx: 23 },
          updateDate: {
            alias: 'Update',
            idx: 24,
            type: 'date',
            default: new Date(),
          },
        },
      },
      flowSymbol: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          symbol: { alias: 'Symbol', idx: 1 },
          symbolKey: { alias: 'Symbol key', idx: 2 },
          quantityInFlow: { alias: 'Quantity in flow', idx: 3 },
          quantityOutFlow: { alias: 'Quantity out flow', idx: 4 },
          quantityRest: { alias: 'Quantity rest', idx: 5 },
          quantityRestLock: { alias: 'Quantity rest lock', idx: 6 },
          quantityRestUnlock: { alias: 'Quantity rest unlock', idx: 7 },
          priceInFlow: { alias: 'Price in flow', idx: 8 },
          priceOutFlow: { alias: 'Price out flow', idx: 9 },
          priceRest: { alias: 'Price rest', idx: 10 },
          costInFlow: { alias: 'Cost in flow', idx: 11 },
          costOutFlow: { alias: 'Cost out flow', idx: 12 },
          costRest: { alias: 'Cost rest', idx: 13 },
          costRestInFlow: { alias: 'Cost rest in flow', idx: 14 },
          costRestLock: { alias: 'Cost rest lock', idx: 15 },
          costRestUnlock: { alias: 'Cost rest unlock', idx: 16 },
          pnlTotal: { alias: 'PnL total', idx: 17 },
          pnlRest: { alias: 'PnL rest', idx: 18 },
          dayInPortfolioAvg: {
            alias: 'Day in Portfolio (avg)',
            idx: 19,
          },
          update: {
            alias: 'Update',
            idx: 20,
            type: 'date',
            default: new Date(),
          },
        },
      },
      flow: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 1 },
          constractor: { alias: 'Contractor', idx: 2 },
          contractorKey: { alias: 'Contractor key', idx: 3 },
          project: { alias: 'Project', idx: 4 },
          projectKey: { alias: 'Project key', idx: 5 },
          symbol: { alias: 'Symbol', idx: 6 },
          symbolKey: { alias: 'Symbol key', idx: 7 },
          quantityInFlow: { alias: 'Quantity in flow', idx: 8 },
          quantityOutFlow: { alias: 'Quantity out flow', idx: 10 },
          quantityRest: { alias: 'Quantity rest', idx: 11 },
          quantityLock: { alias: 'Quantity rest', idx: 12 },
          quantityUnlock: { alias: 'Quantity rest', idx: 13 },
          priceInFlow: { alias: 'Price in flow', idx: 14 },
          priceOutFlow: { alias: 'Price out flow', idx: 15 },
          priceRest: { alias: 'Price rest', idx: 16 },
          costInFlow: { alias: 'Cost in flow', idx: 17 },
          costOutFlow: { alias: 'Cost out flow', idx: 18 },
          costRestInFlow: { alias: 'Cost rest in flow', idx: 19 },
          costRest: { alias: 'Cost rest', idx: 20 },
          costLock: { alias: 'Cost lock', idx: 21 },
          costUnlock: { alias: 'Cost unlock', idx: 22 },
          pnlRest: { alias: 'PnL rest', idx: 23 },
          pnlTotal: { alias: 'PnL total', idx: 24 },
          update: {
            alias: 'Update',
            idx: 25,
            type: 'date',
            default: new Date(),
          },
        },
      },
      historicalPrices: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          yyyymmdd: { alias: 'YYYYMMDD', pk: true, idx: 1, notNull: true },
          source: { alias: 'Source', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 3, notNull: true },
          priceAvg: { alias: 'Avarage price', idx: 4 },
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
      symbolCategory: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          nameRu: { alias: 'Name (ru)', idx: 2, notNull: true },
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

      web3SpaceInterest: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          sort: { alias: 'Sort' },
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
        },
      },
      accounts: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
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
          account: { alias: 'Account', idx: 1 },
          project: { alias: 'Project', idx: 2 },
          mainSymbol: { alias: 'Main symbol', pk: true, idx: 3, notNull: true },
          mainSymbolQty: {
            alias: 'Main symbol qty',
            pk: true,
            idx: 4,
            notNull: true,
          },
          mainSymbolHistoricalCost: {
            alias: 'Main symbol historical cost',
            pk: true,
            idx: 5,
            notNull: true,
          },
          pairOneSymbol: { alias: 'Pair one symbol', idx: 6 },
          pairOneQty: { alias: 'Pair one qty', idx: 7 },
          pairOnePrice: { alias: 'Pair one price', idx: 8 },
          pairTwoSymbol: { alias: 'Pair one symbol', idx: 9 },
          pairTwoQty: { alias: 'Pair two qty', idx: 10 },
          pairTwoPrice: { alias: 'Pair two price', idx: 1 },
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
      this.log.addError('Portfolio.getWorkSheet', error)
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
      this.log.addError('Portfolio.updateOnEdit', error)
    }
  }
}
