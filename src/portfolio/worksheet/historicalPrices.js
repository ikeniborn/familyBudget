import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import { Transactions } from './transactions'
export { HistoricalPrices }

class HistoricalPrices {
  constructor() {
    this.head = new Portfolio().head.historicalPrices
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.sheetName = 'HistoricalPrices'
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName)
    this.values = this.workSheet.getDimension(this.head)
  }

  getOnEdit(range) {
    this.arrayOfObject = this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    ).getArrayOfObject(this.head)
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum)
    })
  }

  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert()
  }

  updateHistoricalPrices() {
    const transactions = Object.values(new Transactions().values).filter(
      (row) => row.price
    )
    const aggHistoricalPrices = transactions.reduce((agg, row) => {
      if (!agg[row.account]) {
        agg[row.account] = {}
      }
      if (!agg[row.account][row.coin]) {
        agg[row.account][row.coin] = {}
        agg[row.account][row.coin]['quantity'] = 0
        agg[row.account][row.coin]['cost'] = 0
        agg[row.account][row.coin]['quantityBuy'] = 0
        agg[row.account][row.coin]['costBuy'] = 0
        agg[row.account][row.coin]['quantitySell'] = 0
        agg[row.account][row.coin]['costSell'] = 0
      }
      const quantity = row.quantity < 0 ? Math.abs(row.quantity) : row.quantity
      const quantityBuy = row.quantity > 0 ? row.quantity : 0
      const quantitySell = row.quantity < 0 ? Math.abs(row.quantity) : 0
      agg[row.account][row.coin]['quantity'] += quantity
      agg[row.account][row.coin]['cost'] += quantity * row.price
      agg[row.account][row.coin]['quantityBuy'] += quantityBuy
      agg[row.account][row.coin]['costBuy'] += quantityBuy * row.price
      agg[row.account][row.coin]['quantitySell'] += quantitySell
      agg[row.account][row.coin]['costSell'] += quantitySell * row.price
      return agg
    }, {})
    const avgHistoricalPricesArrayOfObject = []
    Object.entries(aggHistoricalPrices).forEach(([account, symbolValue]) => {
      Object.entries(symbolValue).forEach(([symbol, values]) => {
        const avgPrice = values.cost / values.quantity || void 0
        if (avgPrice) {
          avgHistoricalPricesArrayOfObject.push({
            rowKey: new Hash(account + symbol).md5,
            account,
            symbol,
            price: values.cost / values.quantity || void 0,
            priceBuy: values.costBuy / values.quantityBuy || void 0,
            priceSell: values.costSell / values.quantitySell || void 0,
          })
        }
      })
    })
    this.workSheet.insertRows(avgHistoricalPricesArrayOfObject, this.head)
  }
}
