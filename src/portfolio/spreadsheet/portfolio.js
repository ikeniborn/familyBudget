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
        type: 'transaction',
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
          date: { alias: 'Date', idx: 16, notNull: true },
          time: { alias: 'Time', idx: 17, notNull: true },
        },
      },
      prices: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: {
            alias: 'Source',
            idx: 1,
            notNull: true,
          },
          name: {
            alias: 'Name',
            idx: 2,
            notNull: true,
          },
          symbol: {
            alias: 'Symbol',
            pk: true,
            idx: 3,
            notNull: true,
          },
          risk: { alias: 'Risk', idx: 4 },
          priceId: { alias: 'Price ID', idx: 5 },
          price: { alias: 'Price', idx: 7 },
        },
      },
      transactions: {
        type: 'fact',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          dateTime: { alias: 'Date and time', idx: 1 },
          account: { alias: 'Account', idx: 2 },
          platform: { alias: 'Platform', idx: 3 },
          service: { alias: 'Service', idx: 4 },
          project: { alias: 'Project', idx: 5 },
          contractor: { alias: 'Contractor', idx: 6 },
          coin: { alias: 'Coin', idx: 7 },
          quantity: { alias: 'Quantity', idx: 8 },
          price: { alias: 'Price', idx: 9 },
          comment: { alias: 'Comment', idx: 10 },
          registryRowNum: { alias: 'Registry row num', idx: 11 },
        },
      },
      balance: {
        type: 'transaction',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          contractor: { alias: 'Contractor', idx: 1 },
          contractorType: { alias: 'Contractor type', idx: 2 },
          project: { alias: 'Project', idx: 3 },
          coin: { alias: 'Coin', idx: 4 },
          risk: { alias: 'Risk', idx: 5 },
          quantity: { alias: 'Quantity', idx: 6 },
          historicalCostBuy: { alias: 'Historical buy cost', idx: 7 },
          historicalCostAvg: { alias: 'Historical average cost', idx: 8 },
          currentCost: { alias: 'Current cost', idx: 9 },
        },
      },
      historicalPrices: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          account: { alias: 'Account', pk: true, idx: 1 },
          project: { alias: 'Project', pk: true, idx: 2 },
          symbol: { alias: 'Symbol', pk: true, idx: 3 },
          priceAvg: { alias: 'Price avg', idx: 4 },
          priceBuy: { alias: 'Price buy', idx: 5 },
          priceSell: { alias: 'Price sell', idx: 6 },
        },
      },
      coins: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: { alias: 'Source', pk: true, idx: 1 },
          name: { alias: 'Name', pk: true, idx: 2 },
          symbol: { alias: 'Symbol', pk: true, idx: 3 },
          id: { alias: 'Id', idx: 4 },
        },
      },
      sources: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      services: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      operations: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      project: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      accounts: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      contractors: {
        type: 'dimension',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
          type: { alias: 'Type', idx: 2 },
          category: { alias: 'Category', idx: 3 },
        },
      },
    }
    this.spreadSheetName = 'portfolio'
  }

  getWorkSheet(sheetName) {
    return new WorkSheet(
      this.spreadSheetName,
      sheetName,
      new Header().getHead(this.workSheetHeads, sheetName)
    )
  }

  updateOnEdit(range) {
    const sheetName = range.getSheet().getSheetName()
    return new WorkSheetRange(
      this.spreadSheetName,
      sheetName,
      new Header().getHead(this.workSheetHeads, sheetName),
      range
    )
  }
}
