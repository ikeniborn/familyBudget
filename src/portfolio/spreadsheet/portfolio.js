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
          risk: { alias: 'Risk', idx: 5 },
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
          comment: { alias: 'Comment', idx: 14 },
          isDelete: { alias: 'Delete', idx: 15 },
          registryRowNum: { alias: 'Registry row num', idx: 16 },
          updateDate: {
            alias: 'Update',
            idx: 17,
            type: 'date',
            default: new Date(),
          },
        },
      },
      balance: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          contractor: { alias: 'Contractor', idx: 1 },
          contractorType: { alias: 'Contractor type', idx: 2 },
          service: { alias: 'Service', idx: 3 },
          project: { alias: 'Project', idx: 4 },
          symbol: { alias: 'Symbol', idx: 5 },
          symbolType: { alias: 'Symbol type', idx: 6 },
          tokenStatus: { alias: 'Token status', idx: 7 },
          risk: { alias: 'Risk category', idx: 8 },
          quantityRest: { alias: 'Quantity rest', idx: 9 },
          quantityBuy: { alias: 'Quantity buy', idx: 10 },
          quantitySell: { alias: 'Quantity sell', idx: 11 },
          quantityRefill: { alias: 'Quantity refill', idx: 12 },
          quantityWriteOff: { alias: 'Quantity write-off', idx: 13 },
          quantityTransferIn: { alias: 'Quantity transfer in', idx: 14 },
          quantityTransferOut: { alias: 'Quantity transfer out', idx: 15 },
          inFlow: { alias: 'In flow', idx: 16 },
          outFlow: { alias: 'Out flow', idx: 17 },
          currentRestCost: { alias: 'Current rest cost', idx: 18 },
          updateDate: {
            alias: 'Update',
            idx: 19,
            type: 'date',
            default: new Date(),
          },
        },
      },
      historicalPricesAvg: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          account: { alias: 'Account', pk: true, idx: 1, notNull: true },
          project: { alias: 'Project', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 3, notNull: true },
          quantityAvg: { alias: 'Quantity avg', idx: 4 },
          quantityBuy: { alias: 'Quantity buy', idx: 5 },
          quantitySell: { alias: 'Quantity sell', idx: 6 },
          quantityRefill: { alias: 'Quantity refill', idx: 7 },
          quantityWriteOff: { alias: 'Quantity write-off', idx: 8 },
          quantityRest: { alias: 'Quantity rest', idx: 8 },
          priceAvg: { alias: 'Price avg', idx: 9 },
          priceBuy: { alias: 'Price buy', idx: 10 },
          priceSell: { alias: 'Price sell', idx: 11 },
          priceRefill: { alias: 'Price refill', idx: 12 },
          priceWriteOff: { alias: 'Price write-off', idx: 13 },
          priceCurrent: { alias: 'Price current', idx: 13 },
          costAvg: { alias: 'Cost avg', idx: 14 },
          costBuy: { alias: 'Cost buy', idx: 15 },
          costSell: { alias: 'Cost sell', idx: 16 },
          costRefill: { alias: 'Cost refill', idx: 17 },
          costWriteOff: { alias: 'Cost write-off', idx: 18 },
          costCurrent: { alias: 'Cost current', idx: 19 },
          inFlow: { alias: 'In flow', idx: 20 },
          outFlow: { alias: 'Out flow', idx: 21 },
        },
      },
      historicalPrices: {
        type: 'fct',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          dateTime: {
            alias: 'Date and time',
            pk: true,
            idx: 1,
            type: 'date',
            notNull: true,
          },
          operation: { alias: 'Operation', idx: 2, pk: true, notNull: true },
          direction: { alias: 'Direction', pk: true, idx: 3, notNull: true },
          account: { alias: 'Account', pk: true, idx: 4, notNull: true },
          project: { alias: 'Project', pk: true, idx: 5, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 6, notNull: true },
          quantity: { alias: 'Quantity', idx: 7 },
          price: { alias: 'Price', idx: 8 },
          isDelete: { alias: 'Is delete', idx: 9 },
          registryRowNum: { alias: 'Registry row num', idx: 10 },
          updateDate: {
            alias: 'Update date',
            idx: 11,
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
          sum: { alias: 'Sum', idx: 3 },
        },
      },
      services: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          tokenStatus: { alias: 'Token status', idx: 2, notNull: true },
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
