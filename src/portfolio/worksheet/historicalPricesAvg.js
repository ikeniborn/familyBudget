import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import { Log } from './log'
export { HistoricalPricesAvg }

class HistoricalPricesAvg {
  constructor(workSheet = '') {
    if (HistoricalPricesAvg.exists) {
      return HistoricalPricesAvg.instance
    }
    HistoricalPricesAvg.instance = this
    HistoricalPricesAvg.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('HistoricalPricesAvg')
  }

  updateHistoricalPricesAvg() {
    const aggHistoricalPrices = new Portfolio()
      .getWorkSheet('transactions')
      .arrayOfObject.filter((tx) => tx.price && !tx.isDelete)
      .reduce((agg, tx) => {
        if (!agg[tx.account]) {
          agg[tx.account] = {}
        }
        if (!agg[tx.account][tx.project]) {
          agg[tx.account][tx.project] = {}
        }
        if (!agg[tx.account][tx.project][tx.coin]) {
          agg[tx.account][tx.project][tx.coin] = {}
          agg[tx.account][tx.project][tx.coin]['quantity'] = 0
          agg[tx.account][tx.project][tx.coin]['cost'] = 0
          agg[tx.account][tx.project][tx.coin]['quantityBuy'] = 0
          agg[tx.account][tx.project][tx.coin]['costBuy'] = 0
          agg[tx.account][tx.project][tx.coin]['quantitySell'] = 0
          agg[tx.account][tx.project][tx.coin]['costSell'] = 0
        }
        const quantity = tx.quantity < 0 ? Math.abs(tx.quantity) : tx.quantity
        const quantityBuy = tx.quantity > 0 ? tx.quantity : 0
        const quantitySell = tx.quantity < 0 ? Math.abs(tx.quantity) : 0
        agg[tx.account][tx.project][tx.coin]['quantity'] += quantity
        agg[tx.account][tx.project][tx.coin]['cost'] += quantity * tx.price
        agg[tx.account][tx.project][tx.coin]['quantityBuy'] += quantityBuy
        agg[tx.account][tx.project][tx.coin]['costBuy'] +=
          quantityBuy * tx.price
        agg[tx.account][tx.project][tx.coin]['quantitySell'] += quantitySell
        agg[tx.account][tx.project][tx.coin]['costSell'] +=
          quantitySell * tx.price
        return agg
      }, {})
    const avgHistoricalPricesArrayOfObject = []
    Object.entries(aggHistoricalPrices).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([project, level1]) => {
        Object.entries(level1).forEach(([symbol, object]) => {
          const avgPrice = object.cost / object.quantity || void 0
          if (avgPrice) {
            avgHistoricalPricesArrayOfObject.push({
              rowKey: new Hash(account + project + symbol).md5,
              account,
              project,
              symbol,
              quantity: object.quantity,
              priceAvg: object.cost / object.quantity || void 0,
              priceBuy: object.costBuy / object.quantityBuy || void 0,
              priceSell: object.costSell / object.quantitySell || void 0,
            })
          }
        })
      })
    })
    this.workSheet.truncateInsertRows(avgHistoricalPricesArrayOfObject)
  }
}
