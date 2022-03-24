import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Header } from '../../header'
import { Hash, FormatDate } from '../../utils'
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

  getPreviousPrice(date, coin, pair = 'usd') {
    const histirocalPricesCoin = Object.values(this.values).filter(
      (row) =>
        new Hash(row.coin).md5 === new Hash(coin).md5 &&
        new FormatDate(row.date).unix <= new FormatDate(date).unix
    )
    const lastDate = Math.max(
      ...histirocalPricesCoin.map((row) => new Date(row.date).valueOf())
    )
    const lastHistoricalPriceKey = new Hash(
      new Date(lastDate).valueOf() + coin + pair
    ).md5
    return this.values[lastHistoricalPriceKey].price
  }

  // updateHistoricalPrice(dateTime, symbol, price) {
  //   const rowKey = new Hash(new Date(dateTime).valueOf() + symbol).md5
  //   if (!this.values[rowKey]) {
  //     this.values[rowKey] = {
  //       rowKey,
  //       dateTime,
  //       symbol,
  //       price,
  //     }
  //     this.workSheet.insertRow(this.values[rowKey], this.head)
  //   } else {
  //     this.values[rowKey].price = price
  //     this.workSheet.updateRow(
  //       this.values[rowKey],
  //       this.head,
  //       this.values[rowKey].rowNum
  //     )
  //   }
  // }
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
      }
      const quantity = row.quantity < 0 ? Math.abs(row.quantity) : row.quantity
      agg[row.account][row.coin]['quantity'] += quantity
      agg[row.account][row.coin]['cost'] += quantity * row.price
      return agg
    }, {})
    // const avgHistoricalPrices = Object.fromEntries(
    //   Object.entries(aggHistoricalPrices).map(([account, symbolValue]) => {
    //     const updateSymbolValue = Object.fromEntries(
    //       Object.entries(symbolValue).map(([symbol, values]) => {
    //         values.price = values.cost / values.quantity
    //         return [symbol, values]
    //       })
    //     )
    //     return [account, updateSymbolValue]
    //   })
    // )
    const avgHistoricalPricesArrayOfObject = []
    Object.entries(aggHistoricalPrices).forEach(([account, symbolValue]) => {
      Object.entries(symbolValue).forEach(([symbol, values]) => {
        values.price = values.cost / values.quantity
        avgHistoricalPricesArrayOfObject.push({
          rowKey: new Hash(account + symbol).md5,
          account,
          symbol,
          // quantity: values.quantity,
          // cost: values.cost,
          price: values.cost / values.quantity,
        })
      })
    })
    this.workSheet.insertRows(avgHistoricalPricesArrayOfObject, this.head)
    console.log(avgHistoricalPricesArrayOfObject)
  }
}
