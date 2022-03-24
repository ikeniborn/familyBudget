import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Transactions } from './transactions'
import { HistoricalPrices } from './historicalPrices'
import { Prices } from './prices'
import { Hash } from '../../utils'
export { Balance }

class Balance {
  constructor() {
    this.head = new Portfolio().head.balance
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.sheetName = 'Balance'
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName)
    // this.values = this.workSheet.getFact(this.head)
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    )
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head)
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

  updateBalance() {
    const historicalPrices = new HistoricalPrices().values
    const prices = new Prices().values
    const aggBalance = Object.values(new Transactions().values).reduce(
      (object, tx) => {
        if (!object[tx.account]) {
          object[tx.account] = {}
        }
        if (!object[tx.account][tx.contractor]) {
          object[tx.account][tx.contractor] = {}
        }
        if (!object[tx.account][tx.contractor][tx.type]) {
          object[tx.account][tx.contractor][tx.type] = {}
        }
        if (!object[tx.account][tx.contractor][tx.type][tx.coin]) {
          object[tx.account][tx.contractor][tx.type][tx.coin] = 0
        }
        object[tx.account][tx.contractor][tx.type][tx.coin] += tx.quantity
        return object
      },
      {}
    )
    const balance = []
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([contractor, level1]) => {
        Object.entries(level1).forEach(([type, level2]) => {
          Object.entries(level2).forEach(([coin, quantity]) => {
            if (quantity) {
              const currentCost = quantity * prices[new Hash(coin).md5]?.price
              const historicalCost =
                quantity *
                  historicalPrices[new Hash(account + coin).md5]?.price || 0
              balance.push({
                account,
                contractor,
                type,
                coin: coin.toUpperCase(),
                quantity,
                historicalCost,
                currentCost,
              })
            }
          })
        })
      })
    })
    this.workSheet.insertRows(balance, this.head)
  }
}
