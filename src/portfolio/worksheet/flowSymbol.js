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
          if (!agg[tx.account][tx.contractor]) {
            agg[tx.account][tx.contractor] = {}
          }
          if (!agg[tx.account][tx.contractor][tx.service]) {
            agg[tx.account][tx.contractor][tx.service] = {}
          }

          if (!agg[tx.account][tx.contractor][tx.service][tx.symbol]) {
            agg[tx.account][tx.contractor][tx.service][tx.symbol] = {
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
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].quantityBuyIn += tx.quantity
              agg[tx.account][tx.contractor][tx.service][tx.symbol].costBuyIn +=
                tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].quantityBuyOut += tx.quantity * -1
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].costBuyOut += tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('sell').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].quantitySellIn += tx.quantity
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].costSellIn += tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].quantitySellOut += tx.quantity * -1
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].costSellOut += tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('refill').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].quantityRefillIn += tx.quantity
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].costRefillIn += tx.cost
            }
          } else if (new Hash(tx.operation).md5 === new Hash('write-off').md5) {
            if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].quantityWriteOffOut += tx.quantity * -1
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].costWriteOffOut += tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('transfer').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].quantityTransferIn += tx.quantity
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].costTransferIn += tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].quantityTransferOut += tx.quantity * -1
              agg[tx.account][tx.contractor][tx.service][
                tx.symbol
              ].costTransferOut += tx.cost * -1
            }
          }
          agg[tx.account][tx.contractor][tx.service][tx.symbol].quantityRest +=
            tx.quantity
          return agg
        }, {})
      const aggFlowArrayOfObject = []
      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          Object.entries(level1).forEach(([service, level2]) => {
            Object.entries(level2).forEach(([symbol, object]) => {
              let newService
              if (
                ['liquidity pool (1)', 'liquidity pool (2)']
                  .map((m) => (m = new Hash(m).md5))
                  .indexOf(new Hash(service).md5) !== -1
              ) {
                newService = 'Liquidity pool'
              } else {
                newService = service + ''
              }
              //* доп. атрибутика
              const priceKey = new Hash(symbol).md5
              const priceRest = prices[priceKey]?.price
              const costRest = prices[priceKey]?.price * object.quantityRest
              const symbolType = prices[priceKey]?.symbolType + ''
              const riskCategory = prices[priceKey]?.risk + ''
              const symbolStatus =
                services[new Hash(service).md5]?.symbolStatus + ''
              //* расчет потоков
              const costInFlow =
                object.costBuyIn +
                object.costSellIn +
                object.costRefillIn +
                object.costTransferIn
              const costOutFlow =
                object.costBuyOut +
                object.costSellOut +
                object.costWriteOffOut +
                object.costTransferOut
              const quantityInFlow =
                object.quantityBuyIn +
                object.quantitySellIn +
                object.quantityRefillIn +
                object.quantityTransferIn
              const quantityOutFlow =
                object.quantityBuyOut +
                object.quantitySellOut +
                object.quantityWriteOffOut +
                object.quantityTransferOut
              //* расчет цены

              const priceInFlow = costInFlow / quantityInFlow
              const priceOutFlow = costOutFlow / quantityOutFlow

              aggFlowArrayOfObject.push({
                account: account.toUpperCase(),
                contractor: contractor.toUpperCase(),
                contractorType: void 0,
                contractorCategory: void 0,
                service: newService.toUpperCase(),
                symbol: symbol.toUpperCase(),
                symbolCategory: void 0,
                symbolType: symbolType.toUpperCase(),
                symbolStatus: symbolStatus.toUpperCase(),
                riskCategory: riskCategory.toUpperCase(),
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
                costRestLock:
                  new Hash(symbolStatus).md5 === new Hash('lock').md5
                    ? costRest
                    : 0,
                costRestUnlock:
                  new Hash(symbolStatus).md5 === new Hash('unlock').md5
                    ? costRest
                    : 0,

                pnl: costOutFlow - costInFlow + costRest || 0,
              })
            })
          })
        })
      })

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject)
    } catch (error) {
      new Log().addError('Flow.updateFlow', error)
    }
  }
}
