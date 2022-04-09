import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import { Log } from './log'
export { FlowSymbol }

class FlowSymbol {
  constructor(workSheet = '') {
    if (FlowSymbol.exists) {
      return Flow.instance
    }
    FlowSymbol.instance = this
    FlowSymbol.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('FlowSymbol')
  }

  updateFlow() {
    try {
      const prices = new Portfolio().getWorkSheet('prices').object
      const services = new Portfolio().getWorkSheet('services').object
      const aggFlow = new Portfolio()
        .getWorkSheet('Transactions')
        .arrayOfObject.filter((row) => !row.isDelete)
        .reduce((agg, tx) => {
          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }

          if (!agg[tx.account][tx.symbol]) {
            agg[tx.account][tx.symbol] = {
              quantityBuyIn: 0,
              quantityBuyOut: 0,
              quantitySellIn: 0,
              quantitySellOut: 0,
              quantityRefillIn: 0,
              quantityWriteOffOut: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
              quantityRest: 0,
              costBuyIn: 0,
              costBuyOut: 0,
              costSellIn: 0,
              costSellOut: 0,
              costRefillIn: 0,
              costWriteOffOut: 0,
              costTransferIn: 0,
              costTransferOut: 0,
            }
          }
          //* Распределение количества по потокам

          if (new Hash(tx.operation).md5 === new Hash('buy').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.symbol].quantityBuyIn += tx.quantity
              agg[tx.account][tx.symbol].costBuyIn += tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.symbol].quantityBuyOut += tx.quantity * -1
              agg[tx.account][tx.symbol].costBuyOut += tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('sell').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.symbol].quantitySellIn += tx.quantity
              agg[tx.account][tx.symbol].costSellIn += tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.symbol].quantitySellOut += tx.quantity * -1
              agg[tx.account][tx.symbol].costSellOut += tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('refill').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.symbol].quantityRefillIn += tx.quantity
              agg[tx.account][tx.symbol].costRefillIn += tx.cost
            }
          } else if (new Hash(tx.operation).md5 === new Hash('write-off').md5) {
            if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.symbol].quantityWriteOffOut += tx.quantity * -1
              agg[tx.account][tx.symbol].costWriteOffOut += tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('transfer').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.symbol].quantityTransferIn += tx.quantity
              agg[tx.account][tx.symbol].costTransferIn += tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.symbol].quantityTransferOut += tx.quantity * -1
              agg[tx.account][tx.symbol].costTransferOut += tx.cost * -1
            }
          }
          agg[tx.account][tx.symbol].quantityRest += tx.quantity
          return agg
        }, {})
      const aggFlowArrayOfObject = []
      Object.entries(aggFlow).forEach(([account, level0]) => {
        // Object.entries(level0).forEach(([contractor, level1]) => {
        // Object.entries(level1).forEach(([service, level2]) => {
        Object.entries(level0).forEach(([symbol, object]) => {
          //* доп. атрибутика
          const symbolKey = new Hash(symbol).md5
          const priceRest = prices[symbolKey]?.price
          const costRest = prices[symbolKey]?.price * object.quantityRest
          // const symbolType = prices[priceKey]?.symbolType + ''
          // const riskCategory = prices[priceKey]?.risk + ''
          //* расчет потоков
          const costInFlow =
            object.costBuyIn + object.costSellIn + object.costRefillIn
          // object.costTransferIn
          const costOutFlow =
            object.costBuyOut + object.costSellOut + object.costWriteOffOut
          // object.costTransferOut
          const quantityInFlow =
            object.quantityBuyIn +
            object.quantitySellIn +
            object.quantityRefillIn
          // object.quantityTransferIn
          const quantityOutFlow =
            object.quantityBuyOut +
            object.quantitySellOut +
            object.quantityWriteOffOut
          // object.quantityTransferOut
          //* расчет цены

          const priceInFlow = costInFlow / quantityInFlow
          const priceOutFlow = costOutFlow / quantityOutFlow

          aggFlowArrayOfObject.push({
            account: account.toUpperCase(),
            symbol: symbol.toUpperCase(),
            symbolKey: symbolKey,
            // symbolCategory: void 0,
            // symbolType: symbolType.toUpperCase(),
            // riskCategory: riskCategory.toUpperCase(),
            // quantityBuyIn: object.quantityBuyIn || 0,
            // quantityBuyOut: object.quantityBuyOut || 0,
            // quantitySellIn: object.quantitySellIn || 0,
            // quantitySellOut: object.quantitySellOut || 0,
            // quantityRefillIn: object.quantityRefillIn || 0,
            // quantityWriteOffOut: object.quantityWriteOffOut || 0,
            // quantityTransferIn: object.quantityTransferIn || 0,
            // quantityTransferOut: object.quantityTransferOut || 0,
            quantityInFlow: quantityInFlow || 0,
            quantityOutFlow: quantityOutFlow || 0,
            quantityRest: object.quantityRest || 0,
            // priceBuy: priceBuy || 0,
            // priceSell: priceSell || 0,
            // priceRefill: priceRefill || 0,
            // priceWriteOff: priceWriteOff || 0,
            // priceTransferIn: priceTransferIn || 0,
            // priceTransferOut: priceTransferOut || 0,
            priceInFlow: priceInFlow || 0,
            priceOutFlow: priceOutFlow || 0,
            priceRest: priceRest || 0,
            // costBuyIn: object.costBuyIn || 0,
            // costBuyOut: object.costBuyOut || 0,
            // costSellIn: object.costSellIn || 0,
            // costSellOut: object.costSellOut || 0,
            // costRefillIn: object.costRefillIn || 0,
            // costWriteOffOut: object.costWriteOffOut || 0,
            // costTransferIn: object.costTransferIn || 0,
            // costTransferOut: object.costTransferOut || 0,
            costInFlow: costInFlow || 0,
            costOutFlow: costOutFlow || 0,
            costRest: costRest || 0,
            costRestInFlow: priceInFlow * object.quantityRest || 0,
            pnlTotal: costOutFlow - costInFlow + costRest || 0,
            pnlRest: costRest - priceInFlow * object.quantityRest || 0,
          })
        })
      })

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject)
    } catch (error) {
      new Log().addError('Flow.updateFlow', error)
    }
  }
}
