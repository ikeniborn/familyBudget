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
      const prices = new Portfolio().getWorkSheet('prices').object
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
              quantityAvg: 0,
              costAvg: 0,
              quantityBuy: 0,
              costBuy: 0,
              quantitySell: 0,
              costSell: 0,
              quantityRefill: 0,
              costRefill: 0,
              quantityWriteOff: 0,
              costWriteOff: 0,
              quantityRest: 0,
            }
          }
          const quantityBuy =
            tx.direction === 'in' && tx.operation === 'buy' ? tx.quantity : 0
          const quantitySell =
            tx.direction === 'out' && tx.operation === 'sell' ? tx.quantity : 0
          const quantityRefill =
            tx.direction === 'in' && tx.operation === 'refill' ? tx.quantity : 0
          const quantityWriteOff =
            tx.direction === 'out' && tx.operation === 'write-off'
              ? tx.quantity
              : 0

          agg[tx.account][tx.project][tx.symbol].quantityRest +=
            quantityBuy - quantitySell + quantityRefill - quantityWriteOff

          agg[tx.account][tx.project][tx.symbol].quantityAvg +=
            quantityBuy + quantityRefill - quantityWriteOff
          agg[tx.account][tx.project][tx.symbol].costAvg +=
            quantityBuy * tx.price

          agg[tx.account][tx.project][tx.symbol].quantityBuy += quantityBuy
          agg[tx.account][tx.project][tx.symbol].costBuy +=
            quantityBuy * tx.price

          agg[tx.account][tx.project][tx.symbol].quantitySell += quantitySell
          agg[tx.account][tx.project][tx.symbol].costSell +=
            quantitySell * tx.price

          agg[tx.account][tx.project][
            tx.symbol
          ].quantityRefill += quantityRefill
          agg[tx.account][tx.project][tx.symbol].costRefill +=
            quantityRefill * tx.price

          agg[tx.account][tx.project][
            tx.symbol
          ].quantityWriteOff += quantityWriteOff
          agg[tx.account][tx.project][tx.symbol].costWriteOff +=
            quantityWriteOff * tx.price

          return agg
        }, {})
      const avgHistoricalPricesArrayOfObject = []
      Object.entries(aggHistoricalPrices).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([project, level1]) => {
          Object.entries(level1).forEach(([symbol, object]) => {
            const pricesKey = new Hash(symbol).md5
            const costCurrent =
              object.quantityRest * prices[pricesKey]?.price || 0

            const inFlow =
              object.costBuy + object.costRefill - object.costWriteOff

            const outFlow = object.costSell + costCurrent
            avgHistoricalPricesArrayOfObject.push({
              rowKey: new Hash(account + project + symbol).md5,
              account: account.toUpperCase(),
              project: project.toUpperCase(),
              symbol: symbol.toUpperCase(),
              quantityAvg: object.quantityAvg || 0,
              quantityBuy: object.quantityBuy || 0,
              quantitySell: object.quantitySell || 0,
              quantityRefill: object.quantityRefill || 0,
              quantityWriteOff: object.quantityWriteOff || 0,
              quantityRest: object.quantityRest || 0,
              priceAvg: object.costAvg / object.quantityAvg || 0,
              priceBuy: object.costBuy / object.quantityBuy || 0,
              priceSell: object.costSell / object.quantitySell || 0,
              priceRefill: object.costRefill / object.quantityRefill || 0,
              priceWriteOff: object.costWriteOff / object.quantityWriteOff || 0,
              priceCurrent: prices[pricesKey]?.price || 0,
              costAvg: object.costAvg || 0,
              costBuy: object.costBuy || 0,
              costSell: object.costSell || 0,
              costRefill: object.costRefill || 0,
              costWriteOff: object.costWriteOff || 0,
              costCurrent: costCurrent || 0,
              inFlow: inFlow || 0,
              outFlow: outFlow || 0,
            })
          })
        })
      })
      this.workSheet.truncateInsertRows(avgHistoricalPricesArrayOfObject)
    } catch (error) {
      new Log().addError('HistoricalPricesAvg.updateHistoricalPricesAvg', error)
    } finally {
    }
  }
}
