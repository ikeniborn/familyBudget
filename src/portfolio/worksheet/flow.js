import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import { Log } from './log'
export { Flow }

class Flow {
  constructor(workSheet = '') {
    if (Flow.exists) {
      return Flow.instance
    }
    Flow.instance = this
    Flow.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Flow')
  }

  updateFlow() {
    try {
      const prices = new Portfolio().getWorkSheet('prices').object
      const aggFlow = new Portfolio()
        .getWorkSheet('Transactions')
        .arrayOfObject.filter((row) => !row.isDelete)
        .reduce((agg, tx) => {
          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }

          if (!agg[tx.account][tx.symbol]) {
            agg[tx.account][tx.symbol] = {
              quantityBuy: 0,
              quantitySell: 0,
              quantityRefill: 0,
              quantityWriteOff: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
              quantityRest: 0,
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
          let quantityRest = 0
          let costBuy = 0
          let costSell = 0
          let costRefill = 0
          let costWriteOff = 0
          let costTransferIn = 0
          let costTransferOut = 0

          if (new Hash(tx.operation).md5 === new Hash('buy').md5) {
            quantityBuy += tx.quantity
            costBuy += tx.cost
          } else if (new Hash(tx.operation).md5 === new Hash('sell').md5) {
            quantitySell += tx.quantity
            costSell += tx.cost
          } else if (new Hash(tx.operation).md5 === new Hash('refill').md5) {
            quantityRefill += tx.quantity
            costRefill += 0 //tx.cost
          } else if (new Hash(tx.operation).md5 === new Hash('write-off').md5) {
            quantityWriteOff += tx.quantity * -1
            costRefill += tx.cost * -1
          } else if (
            new Hash(tx.operation + tx.direction).md5 ===
            new Hash('transfer' + 'in').md5
          ) {
            quantityTransferIn += tx.quantity
            costTransferIn += 0 //tx.cost
          } else if (
            new Hash(tx.operation + tx.direction).md5 ===
            new Hash('transfer' + 'out').md5
          ) {
            quantityTransferOut += tx.quantity * -1
            costTransferOut += 0 //tx.cost * -1
          }

          agg[tx.account][tx.symbol].quantityBuy += quantityBuy
          agg[tx.account][tx.symbol].costBuy += costBuy

          agg[tx.account][tx.symbol].quantitySell += quantitySell
          agg[tx.account][tx.symbol].costSell += costSell

          agg[tx.account][tx.symbol].quantityRefill += quantityRefill
          agg[tx.account][tx.symbol].costRefill += costRefill

          agg[tx.account][tx.symbol].quantityWriteOff += quantityWriteOff
          agg[tx.account][tx.symbol].costWriteOff += costWriteOff

          agg[tx.account][tx.symbol].quantityTransferIn += quantityTransferIn
          agg[tx.account][tx.symbol].costTransferIn += costTransferIn

          agg[tx.account][tx.symbol].quantityTransferOut += quantityTransferOut
          agg[tx.account][tx.symbol].costTransferOut += costTransferOut

          agg[tx.account][tx.symbol].quantityRest += tx.quantity

          return agg
        }, {})
      const aggFlowArrayOfObject = []

      Object.entries(aggFlow).forEach(([account, level0]) => {
        // Object.entries(level0).forEach(([project, level1]) => {
        Object.entries(level0).forEach(([symbol, object]) => {
          const positiveObject = Object.fromEntries(
            Object.entries(object).map(([key, value]) => {
              return [
                key,
                value < 0 && key !== 'quantityRest' ? value * -1 : value,
              ]
            })
          )
          const priceKey = new Hash(symbol).md5
          const priceRest = prices[priceKey]?.price
          const symbolType = prices[priceKey]?.symbolType + ''
          const riskCategory = prices[priceKey]?.risk + ''
          //* расчет потоков
          const costInFlow =
            positiveObject.costBuy +
            positiveObject.costRefill +
            positiveObject.costTransferIn
          const costOutFlow =
            positiveObject.costSell +
            positiveObject.costWriteOff +
            positiveObject.costTransferOut
          const quantityInFlow =
            positiveObject.quantityBuy +
            positiveObject.quantityRefill +
            positiveObject.quantityTransferIn
          const quantityOutFlow =
            positiveObject.quantitySell +
            positiveObject.quantityWriteOff +
            positiveObject.quantityTransferOut
          const quantityRest = positiveObject.quantityRest
          const costRest = quantityRest * priceRest
          //* расчет цены
          const priceBuy = positiveObject.costBuy / positiveObject.quantityBuy
          const priceSell =
            positiveObject.costSell / positiveObject.quantitySell
          const priceRefill =
            positiveObject.costRefill / positiveObject.quantityRefill
          const priceWriteOff =
            positiveObject.costWriteOff / positiveObject.quantityWriteOff
          const priceTransferIn =
            positiveObject.costTransferIn / positiveObject.quantityTransferIn
          const priceTransferOut =
            positiveObject.costTransferOut / positiveObject.quantityTransferOut
          const priceInFlow = costInFlow / quantityInFlow
          const priceOutFlow = costOutFlow / quantityOutFlow

          aggFlowArrayOfObject.push({
            rowKey: new Hash(account + symbol).md5,
            account: account.toUpperCase(),
            // project: project.toUpperCase(),
            symbol: symbol.toUpperCase(),
            symbolType: symbolType.toUpperCase(),
            riskCategory: riskCategory.toUpperCase(),
            quantityBuy: positiveObject.quantityBuy || 0,
            quantitySell: positiveObject.quantitySell || 0,
            quantityRefill: positiveObject.quantityRefill || 0,
            quantityWriteOff: positiveObject.quantityWriteOff || 0,
            quantityTransferIn: positiveObject.quantityTransferIn || 0,
            quantityTransferOut: positiveObject.quantityTransferOut || 0,
            quantityWriteOff: positiveObject.quantityWriteOff || 0,
            quantityInFlow: quantityInFlow || 0,
            quantityOutFlow: quantityOutFlow || 0,
            quantityRest: quantityRest || 0,
            priceBuy: priceBuy || 0,
            priceSell: priceSell || 0,
            priceRefill: priceRefill || 0,
            priceWriteOff: priceWriteOff || 0,
            priceTransferIn: priceTransferIn || 0,
            priceTransferOut: priceTransferOut || 0,
            priceInFlow: priceInFlow || 0,
            priceOutFlow: priceOutFlow || 0,
            priceRest: priceRest || 0,
            costBuy: positiveObject.costBuy || 0,
            costSell: positiveObject.costSell || 0,
            costRefill: positiveObject.costRefill || 0,
            costWriteOff: positiveObject.costWriteOff || 0,
            costTransferIn: positiveObject.costTransferIn || 0,
            costTransferOut: positiveObject.costTransferOut || 0,
            costInFlow: costInFlow || 0,
            costOutFlow: costOutFlow || 0,
            costRest: costRest || 0,
          })
        })
        // })
      })

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject)
    } catch (error) {
      new Log().addError('Flow.updateFlow', error)
    }
  }
}
