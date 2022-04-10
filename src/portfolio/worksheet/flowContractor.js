import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import { Log } from './log'
export { FlowContractor }

class FlowContractor {
  constructor(workSheet = '') {
    if (FlowContractor.exists) {
      return FlowContractor.instance
    }
    FlowContractor.instance = this
    FlowContractor.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('FlowContractor')
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
          if (!agg[tx.account][tx.contractor]) {
            agg[tx.account][tx.contractor] = {}
          }

          if (!agg[tx.account][tx.contractor][tx.symbol]) {
            agg[tx.account][tx.contractor][tx.symbol] = {}
          }

          if (!agg[tx.account][tx.contractor][tx.symbol][tx.isLock]) {
            agg[tx.account][tx.contractor][tx.symbol][tx.isLock] = {
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
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].quantityBuyIn += tx.quantity
              agg[tx.account][tx.contractor][tx.symbol][tx.isLock].costBuyIn +=
                tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].quantityBuyOut += tx.quantity * -1
              agg[tx.account][tx.contractor][tx.symbol][tx.isLock].costBuyOut +=
                tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('sell').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].quantitySellIn += tx.quantity
              agg[tx.account][tx.contractor][tx.symbol][tx.isLock].costSellIn +=
                tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].quantitySellOut += tx.quantity * -1
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].costSellOut += tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('refill').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].quantityRefillIn += tx.quantity
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].costRefillIn += tx.cost
            }
          } else if (new Hash(tx.operation).md5 === new Hash('write-off').md5) {
            if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].quantityWriteOffOut += tx.quantity * -1
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].costWriteOffOut += tx.cost * -1
            }
          } else if (new Hash(tx.operation).md5 === new Hash('transfer').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].quantityTransferIn += tx.quantity
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].costTransferIn += tx.cost
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].quantityTransferOut += tx.quantity * -1
              agg[tx.account][tx.contractor][tx.symbol][
                tx.isLock
              ].costTransferOut += tx.cost * -1
            }
          }

          agg[tx.account][tx.contractor][tx.symbol][tx.isLock].quantityRest +=
            tx.quantity

          return agg
        }, {})
      const aggFlowArrayOfObject = []

      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          const contractorKey = new Hash(contractor).md5
          Object.entries(level1).forEach(([symbol, level2]) => {
            const symbolKey = new Hash(symbol).md5
            const priceRest = prices[symbolKey]?.price
            Object.entries(level2).forEach(([isLock, object]) => {
              const costRest = priceRest * object.quantityRest
              //* расчет потоков с учетом перемещений
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
                constractor: contractor.toUpperCase(),
                contractorKey: contractorKey,
                symbol: symbol.toUpperCase(),
                symbolKey: symbolKey,
                isLock: isLock,
                quantityInFlow: quantityInFlow || 0,
                quantityOutFlow: quantityOutFlow || 0,
                quantityRest: object.quantityRest || 0,
                priceInFlow: priceInFlow || 0,
                priceOutFlow: priceOutFlow || 0,
                priceRest: priceRest || 0,
                costInFlow: costInFlow || 0,
                costOutFlow: costOutFlow || 0,
                costRest: costRest || 0,
                costRestInFlow: priceInFlow * object.quantityRest || 0,
                pnlTotal: costOutFlow - costInFlow + costRest || 0,
                pnlRest: costRest - priceInFlow * object.quantityRest || 0,
              })
            })
          })
        })
      })

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject)
    } catch (error) {
      new Log().addError('FlowContractors.updateFlow', error)
    }
  }
}
