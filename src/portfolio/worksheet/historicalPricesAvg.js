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
    try {
      const aggHistoricalPrices = new Portfolio()
        .getWorkSheet('HistoricalPrices')
        .arrayOfObject.filter((row) => !row.isDelete)
        .reduce((agg, tx) => {
          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }
          if (!agg[tx.account][tx.project]) {
            agg[tx.account][tx.project] = {}
          }
          if (!agg[tx.account][tx.project][tx.symbol]) {
            agg[tx.account][tx.project][tx.symbol] = {
              quantity: 0,
              cost: 0,
              quantityBuy: 0,
              costBuy: 0,
              quantitySell: 0,
              costSell: 0,
            }
          }
          const quantity = tx.quantity
          const quantityBuy =
            tx.direction === 'in' && tx.operation === 'buy' ? tx.quantity : 0
          const quantitySell =
            tx.direction === 'out' && tx.operation === 'sell' ? tx.quantity : 0
          agg[tx.account][tx.project][tx.symbol].quantity += quantity
          agg[tx.account][tx.project][tx.symbol].cost += quantity * tx.price
          agg[tx.account][tx.project][tx.symbol].quantityBuy += quantityBuy
          agg[tx.account][tx.project][tx.symbol].costBuy +=
            tx.operation === 'buy' ? quantity * tx.price : 0
          agg[tx.account][tx.project][tx.symbol].quantitySell += quantitySell
          agg[tx.account][tx.project][tx.symbol].costSell +=
            tx.operation === 'sell' ? quantitySell * tx.price : 0

          return agg
        }, {})
      const avgHistoricalPricesArrayOfObject = []
      const prices = new Portfolio().getWorkSheet('prices').object
      Object.entries(aggHistoricalPrices).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([project, level1]) => {
          Object.entries(level1).forEach(([symbol, object]) => {
            const avgPrice = object.cost / object.quantity || 0
            if (avgPrice) {
              const pricesKey = new Hash(symbol).md5
              avgHistoricalPricesArrayOfObject.push({
                rowKey: new Hash(account + project + symbol).md5,
                account: account.toUpperCase(),
                project: project.toUpperCase(),
                symbol: symbol.toUpperCase(),
                quantity: object.quantity || 0,
                quantityBuy: object.quantityBuy || 0,
                quantitySell: object.quantitySell || 0,
                quantityRest: object.quantityBuy - object.quantitySell || 0,
                priceAvg: object.cost / object.quantity || 0,
                priceBuy: object.costBuy / object.quantityBuy || 0,
                priceSell: object.costSell / object.quantitySell || 0,
                priceCurr: prices[pricesKey]?.price || 0,
              })
            }
          })
        })
      })
      this.workSheet.truncateInsertRows(avgHistoricalPricesArrayOfObject)
    } catch (error) {
      new Log().addError('HistoricalPricesAvg.updateHistoricalPricesAvg', error)
    }
  }
}
