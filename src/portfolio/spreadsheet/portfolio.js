import { Environment } from '../../gas'
import { Header } from '../../header'
import { WorkSheet, WorkSheetRange } from '../../gas'
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
          project: { alias: 'Project', idx: 3 },
          platform: { alias: 'Platform', idx: 4, notNull: true },
          service: { alias: 'Service', idx: 5, notNull: true },
          sender: { alias: 'Sender', idx: 6, notNull: true },
          recipient: { alias: 'Recipient', idx: 7 },
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
          symbolType: {
            alias: 'Symbol type',
            idx: 4,
            notNull: true,
          },
          riskCategory: { alias: 'Risk category', idx: 5 },
          id: { alias: 'Id', idx: 6 },
          price: { alias: 'Price', idx: 7 },
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
          sourceKey: { alias: 'Source key', idx: 1 },
          sourceName: { alias: 'Source name', idx: 2 },
          dateTime: { alias: 'Date and time', idx: 3, type: 'date' },
          operation: { alias: 'Operation', idx: 4 },
          direction: { alias: 'Direction', idx: 5 },
          account: { alias: 'Account', idx: 6 },
          platform: { alias: 'Platform', idx: 7 },
          service: { alias: 'Service', idx: 8 },
          project: { alias: 'Project', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          mainSymbol: { alias: 'Main coin', idx: 11 },
          symbol: { alias: 'Coin', idx: 12 },
          quantity: { alias: 'Quantity', idx: 13 },
          price: { alias: 'Price', idx: 14 },
          cost: { alias: 'Cost', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          isDelete: { alias: 'Delete', idx: 17 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 19 },
          isFee: { alias: 'Is fee', idx: 19 },
          isLock: { alias: 'Is lock', idx: 20 },
          registryRowNum: { alias: 'Registry row num', idx: 21 },
          updateDate: {
            alias: 'Update',
            idx: 22,
            type: 'date',
            default: new Date(),
          },
        },
      },

      // historicalPrices: {
      //   type: 'fct',
      //   rowNum: 1,
      //   columns: {
      //     rowKey: { alias: 'Row key', idx: 0 },
      //     dateTime: {
      //       alias: 'Date and time',
      //       pk: true,
      //       idx: 1,
      //       type: 'date',
      //       notNull: true,
      //     },
      //     operation: { alias: 'Operation', idx: 2, pk: true, notNull: true },
      //     direction: { alias: 'Direction', pk: true, idx: 3, notNull: true },
      //     account: { alias: 'Account', pk: true, idx: 4, notNull: true },
      //     project: { alias: 'Project', pk: true, idx: 5, notNull: true },
      //     symbol: { alias: 'Symbol', pk: true, idx: 6, notNull: true },
      //     quantity: { alias: 'Quantity', idx: 7 },
      //     price: { alias: 'Price', idx: 8 },
      //     isDelete: { alias: 'Is delete', idx: 9 },
      //     registryRowNum: { alias: 'Registry row num', idx: 10 },
      //     updateDate: {
      //       alias: 'Update date',
      //       idx: 11,
      //       type: 'date',
      //       default: new Date(),
      //     },
      //   },
      // },
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
          priceInFlow: { alias: 'Price in flow', idx: 6 },
          priceOutFlow: { alias: 'Price out flow', idx: 7 },
          priceRest: { alias: 'Price rest', idx: 8 },
          costInFlow: { alias: 'Cost in flow', idx: 9 },
          costOutFlow: { alias: 'Cost out flow', idx: 10 },
          costRest: { alias: 'Cost rest', idx: 11 },
          costRestInFlow: { alias: 'Cost rest in flow', idx: 12 },
          pnlTotal: { alias: 'PnL total', idx: 13 },
          pnlRest: { alias: 'PnL rest', idx: 14 },
          update: {
            alias: 'Update',
            idx: 15,
            type: 'date',
            default: new Date(),
          },
        },
      },
      flowContractor: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          constractor: { alias: 'Contractor', idx: 0 },
          contractorKey: { alias: 'Contractor key', idx: 0 },
          symbol: { alias: 'Symbol', idx: 1 },
          symbolKey: { alias: 'Symbol key', idx: 2 },
          isLock: { alias: 'Is lock', idx: 2 },
          quantityInFlow: { alias: 'Quantity in flow', idx: 3 },
          quantityOutFlow: { alias: 'Quantity out flow', idx: 4 },
          quantityRest: { alias: 'Quantity rest', idx: 5 },
          quantityRest: { alias: 'Quantity rest', idx: 5 },
          priceInFlow: { alias: 'Price in flow', idx: 6 },
          priceOutFlow: { alias: 'Price out flow', idx: 7 },
          priceRest: { alias: 'Price rest', idx: 8 },
          costInFlow: { alias: 'Cost in flow', idx: 9 },
          costOutFlow: { alias: 'Cost out flow', idx: 10 },
          costRest: { alias: 'Cost rest', idx: 11 },
          costRestInFlow: { alias: 'Cost rest in flow', idx: 12 },
          pnlTotal: { alias: 'PnL total', idx: 13 },
          pnlRest: { alias: 'PnL rest', idx: 14 },
          update: {
            alias: 'Update',
            idx: 15,
            type: 'date',
            default: new Date(),
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
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      symbolType: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1 },
          strategy: { alias: 'Strategy', idx: 2 },
        },
      },
      strategy: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          distribution: { alias: 'Distribution', idx: 2 },
        },
      },
      services: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          symbolStatus: { alias: 'Symbol status', idx: 2, notNull: true },
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
      project: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
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
      contractors: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          type: { alias: 'Type', idx: 2 },
          category: { alias: 'Category', idx: 3 },
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
      log: {
        type: 'tx',
        rowNum: 1,
        columns: {
          dateTime: { alias: 'Date and time', idx: 0, type: 'date' },
          method: { alias: 'Method', idx: 1 },
          type: { alias: 'Type', idx: 2 },
          name: { alias: 'Name', idx: 3 },
          message: { alias: 'Message', idx: 4 },
          stack: { alias: 'Stack', idx: 5 },
        },
      },
    }
    this.spreadSheetName = 'portfolio'
  }

  getWorkSheet(sheetName) {
    let headSheetName = sheetName
    if (sheetName.match('Registry')) {
      headSheetName = 'Registry'
    }
    const head = new Header().getHead(this.workSheetHeads, headSheetName)
    return new WorkSheet(this.spreadSheetName, sheetName, head)
  }

  updateOnEdit(range) {
    let sheetName, headSheetName
    sheetName = range.getSheet().getSheetName()
    headSheetName = sheetName
    if (sheetName.match('Registry')) {
      headSheetName = 'Registry'
    }
    const head = new Header().getHead(this.workSheetHeads, headSheetName)
    const workSheet = new WorkSheetRange(
      this.spreadSheetName,
      sheetName,
      head,
      range
    )
    return workSheet
  }
}
