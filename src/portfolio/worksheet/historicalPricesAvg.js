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
      // const prices = new Portfolio().getWorkSheet('prices').object
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
              quantityBuy: 0,
              quantitySell: 0,
              quantityRefill: 0,
              quantityWriteOff: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
              // quantityRest: 0,
              costBuy: 0,
              costSell: 0,
              costRefill: 0,
              costWriteOff: 0,
              costTransferIn: 0,
              costTransferOut: 0,
            }
          }
          //* Распределение количества по потокам
          let quantityBuy = 0
          let quantitySell = 0
          let quantityRefill = 0
          let quantityWriteOff = 0
          let quantityTransferIn = 0
          let quantityTransferOut = 0

          new Hash(tx.operation).md5 === new Hash('buy').md5
            ? (quantityBuy += tx.quantity)
            : (quantityBuy += 0)

          new Hash(tx.operation).md5 === new Hash('sell').md5
            ? (quantitySell += tx.quantity)
            : (quantitySell += 0)

          new Hash(tx.operation).md5 === new Hash('refill').md5
            ? (quantityRefill += tx.quantity)
            : (quantityRefill += 0)

          new Hash(tx.operation).md5 === new Hash('write-off').md5
            ? (quantityWriteOff += tx.quantity * -1)
            : (quantityWriteOff += 0)

          new Hash(tx.operation + tx.direction).md5 ===
          new Hash('transfer' + 'in').md5
            ? (quantityTransferIn += tx.quantity)
            : (quantityTransferIn += 0)

          new Hash(tx.operation + tx.direction).md5 ===
          new Hash('transfer' + 'out').md5
            ? (quantityTransferOut += tx.quantity * -1)
            : (quantityTransferOut += 0)

          // agg[tx.account][tx.project][tx.symbol].quantityRest += tx.quantity

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

          agg[tx.account][tx.project][
            tx.symbol
          ].quantityTransferIn += quantityTransferIn
          agg[tx.account][tx.project][tx.symbol].costTransferIn +=
            quantityTransferIn * tx.price

          agg[tx.account][tx.project][
            tx.symbol
          ].quantityTransferOut += quantityTransferOut
          agg[tx.account][tx.project][tx.symbol].costTransferOut +=
            quantityTransferOut * tx.price

          return agg
        }, {})
      const avgHistoricalPricesArrayOfObject = []
      Object.entries(aggHistoricalPrices).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([project, level1]) => {
          Object.entries(level1).forEach(([symbol, object]) => {
            const costInFlow =
              object.costBuy + object.costRefill + object.costTransferIn
            const costOutFlow =
              object.costSell + object.costWriteOff + object.costTransferOut
            const quantityInFlow =
              object.quantityBuy +
              object.quantityRefill +
              object.quantityTransferIn
            const quantityOutFlow =
              object.quantitySell +
              object.quantityWriteOff +
              object.quantityTransferOut
            const objectRow = {
              rowKey: new Hash(account + project + symbol).md5,
              account: account.toUpperCase(),
              project: project.toUpperCase(),
              symbol: symbol.toUpperCase(),
              quantityBuy: object.quantityBuy || 0,
              quantitySell: object.quantitySell || 0,
              quantityRefill: object.quantityRefill || 0,
              quantityWriteOff: object.quantityWriteOff || 0,
              quantityTransferIn: object.quantityTransferIn || 0,
              quantityTransferOut: object.quantityTransferOut || 0,
              quantityWriteOff: object.quantityWriteOff || 0,
              quantityInFlow: quantityInFlow || 0,
              quantityOutFlow: quantityOutFlow || 0,
              priceBuy: object.costBuy / object.quantityBuy || 0,
              priceSell: object.costSell / object.quantitySell || 0,
              priceRefill: object.costRefill / object.quantityRefill || 0,
              priceWriteOff: object.costWriteOff / object.quantityWriteOff || 0,
              priceTransferIn:
                object.costTransferIn / object.quantityTransferIn || 0,
              priceTransferOut:
                object.costTransferOut / object.quantityTransferOut || 0,
              costBuy: object.costBuy || 0,
              costSell: object.costSell || 0,
              costRefill: object.costRefill || 0,
              costWriteOff: object.costWriteOff || 0,
              costTransferIn: object.costTransferIn || 0,
              costTransferOut: object.costTransferOut || 0,
              costInFlow: costInFlow || 0,
              costOutFlow: costOutFlow || 0,
            }
            avgHistoricalPricesArrayOfObject.push(objectRow)
          })
        })
      })

      this.workSheet.truncateInsertRows(avgHistoricalPricesArrayOfObject)
    } catch (error) {
      new Log().addError('HistoricalPricesAvg.updateHistoricalPricesAvg', error)
    }
  }
}
