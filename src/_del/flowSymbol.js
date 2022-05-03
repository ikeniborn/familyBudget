import { Portfolio } from '../portfolio/spreadsheet/portfolio'
import { Hash, FormatDate } from '../utils'
import { Prices } from '../portfolio/worksheet/prices'
import { Transactions } from '../portfolio/worksheet/transactions'
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
      const prices = new Prices().workSheet.object
      const inKey = new Hash('in').md5
      const outKey = new Hash('out').md5
      const aggFlow = new Transactions().workSheet.arrayOfObject
        .filter((row) => !row.isDelete)
        .reduce((agg, tx) => {
          const operationKey = new Hash(tx.operation).md5
          const directionKey = new Hash(tx.direction).md5
          const dayInPortfolio = new FormatDate().diffBetweenDate(tx.dateTime)
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
              quantityRestLock: 0,
              quantityRestUnlock: 0,
              costBuyIn: 0,
              costBuyOut: 0,
              costSellIn: 0,
              costSellOut: 0,
              costRefillIn: 0,
              costWriteOffOut: 0,
              costTransferIn: 0,
              costTransferOut: 0,
              dayInPortfolioBuyInSum: 0,
              dayInPortfolioBuyOutSum: 0,
              dayInPortfolioSellOutSum: 0,
              dayInPortfolioSellInSum: 0,
              dayInPortfolioRefillInSum: 0,
              dayInPortfolioWriteOffOutSum: 0,
            }
          }
          //* Распределение количества по потокам

          if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
            if (directionKey === inKey) {
              agg[tx.account][tx.symbol].quantityBuyIn += tx.quantity
              agg[tx.account][tx.symbol].costBuyIn += tx.cost
              agg[tx.account][tx.symbol].dayInPortfolioBuyInSum +=
                dayInPortfolio * tx.quantity
            } else if (directionKey === outKey) {
              agg[tx.account][tx.symbol].quantityBuyOut += tx.quantity * -1
              agg[tx.account][tx.symbol].costBuyOut += tx.cost * -1
              agg[tx.account][tx.symbol].dayInPortfolioBuyOutSum +=
                dayInPortfolio * tx.quantity * -1
            }
          } else if (
            operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.symbol].quantitySellIn += tx.quantity
              agg[tx.account][tx.symbol].costSellIn += tx.cost
              agg[tx.account][tx.symbol].dayInPortfolioSellInSum +=
                dayInPortfolio * tx.quantity
            } else if (directionKey === outKey) {
              agg[tx.account][tx.symbol].quantitySellOut += tx.quantity * -1
              agg[tx.account][tx.symbol].costSellOut += tx.cost * -1
              agg[tx.account][tx.symbol].dayInPortfolioSellOutSum +=
                dayInPortfolio * tx.quantity * -1
            }
          } else if (
            operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.symbol].quantityRefillIn += tx.quantity
              agg[tx.account][tx.symbol].costRefillIn += tx.cost
              agg[tx.account][tx.symbol].dayInPortfolioRefillInSum +=
                dayInPortfolio * tx.quantity
            }
          } else if (
            operationKey === '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
          ) {
            if (directionKey === outKey) {
              agg[tx.account][tx.symbol].quantityWriteOffOut += tx.quantity * -1
              agg[tx.account][tx.symbol].costWriteOffOut += tx.cost * -1
              agg[tx.account][tx.symbol].dayInPortfolioWriteOffOutSum +=
                dayInPortfolio * tx.quantity * -1
            }
          } else if (
            operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.symbol].quantityTransferIn += tx.quantity
              agg[tx.account][tx.symbol].costTransferIn += tx.cost
            } else if (directionKey === outKey) {
              agg[tx.account][tx.symbol].quantityTransferOut += tx.quantity * -1
              agg[tx.account][tx.symbol].costTransferOut += tx.cost * -1
            }
          }

          if (tx.isLock) {
            agg[tx.account][tx.symbol].quantityRestLock += tx.quantity
          } else {
            agg[tx.account][tx.symbol].quantityRestUnlock += tx.quantity
          }
          agg[tx.account][tx.symbol].quantityRest += tx.quantity
          return agg
        }, {})
      const aggFlowArrayOfObject = []
      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([symbol, object]) => {
          //* доп. атрибуты
          const symbolKey = new Hash(symbol).md5
          const priceRest = prices[symbolKey]?.price || 0
          const costRest =
            Math.round(priceRest * object.quantityRest * 100) / 100
          const costRestLock = priceRest * object.quantityRestLock
          const costRestUnlock = priceRest * object.quantityRestUnlock

          //* расчет потоков без перемещений. т.к. между токенами нет перемещений
          const costInFlow =
            object.costBuyIn + object.costSellIn + object.costRefillIn

          const costOwnInFlow = object.costBuyIn + object.costSellIn

          const costOutFlow =
            object.costBuyOut + object.costSellOut + object.costWriteOffOut

          const quantityInFlow =
            object.quantityBuyIn +
            object.quantitySellIn +
            object.quantityRefillIn

          const quantityOwnInFlow = object.quantityBuyIn + object.quantitySellIn

          const quantityOutFlow =
            object.quantityBuyOut +
            object.quantitySellOut +
            object.quantityWriteOffOut

          //* расчет цены потоков

          const priceInFlow = costOwnInFlow / quantityOwnInFlow
          const priceOwnInFlow = costInFlow / quantityInFlow
          const priceOutFlow = costOutFlow / quantityOutFlow

          //* Расчет среднего времени в портфеле

          const dayInPortfolioAvg =
            object.dayInPortfolioBuyInSum / object.quantityBuyIn ||
            0 + object.dayInPortfolioSellInSum / object.quantitySellIn ||
            0 + object.dayInPortfolioRefillInSum / object.quantityRefillIn ||
            0 -
              (object.dayInPortfolioBuyOutSum / object.quantityBuyOut ||
                0 + object.dayInPortfolioSellOutSum / object.quantitySellOut ||
                0 +
                  object.dayInPortfolioWriteOffOutSum /
                    object.quantityWriteOffOut ||
                0)

          //* Процент окупаемости от вложения собвственных средств

          const payback = costOutFlow - costOwnInFlow
          if (costRest) {
            aggFlowArrayOfObject.push({
              account: account.toUpperCase(),
              symbol: symbol.toUpperCase(),
              symbolKey: symbolKey,
              quantityOwnInFlow: quantityOwnInFlow || 0,
              quantityInFlow: quantityInFlow || 0,
              quantityOutFlow: quantityOutFlow || 0,
              quantityRest: object.quantityRest || 0,
              quantityRestLock: object.quantityRestLock || 0,
              quantityRestUnlock: object.quantityRestUnlock || 0,
              priceOwnInFlow: priceOwnInFlow || 0,
              priceInFlow: priceInFlow || 0,
              priceOutFlow: priceOutFlow || 0,
              priceRest: priceRest || 0,
              costOwnInFlow: costOwnInFlow || 0,
              costInFlow: costInFlow || 0,
              costOutFlow: costOutFlow || 0,
              costRest: costRest || 0,
              costRestInFlow: priceInFlow * object.quantityRest || 0,
              costRestLock: costRestLock || 0,
              costRestUnlock: costRestUnlock || 0,
              pnlTotal: costOutFlow - costInFlow + costRest || 0,
              pnlRest: costRest - priceInFlow * object.quantityRest || 0,
              payback: payback || 0,
              dayInPortfolioAvg,
            })
          }
        })
      })

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject)
    } catch (error) {
      console.error('FlowSymbol.updateFlow', error.stack)
    }
  }
}

//* Deprecated
//* FlowSymbol.updateFlow
// quantityBuyIn: object.quantityBuyIn || 0,
// quantityBuyOut: object.quantityBuyOut || 0,
// quantitySellIn: object.quantitySellIn || 0,
// quantitySellOut: object.quantitySellOut || 0,
// quantityRefillIn: object.quantityRefillIn || 0,
// quantityWriteOffOut: object.quantityWriteOffOut || 0,
// quantityTransferIn: object.quantityTransferIn || 0,
// quantityTransferOut: object.quantityTransferOut || 0,
// priceBuy: priceBuy || 0,
// priceSell: priceSell || 0,
// priceRefill: priceRefill || 0,
// priceWriteOff: priceWriteOff || 0,
// priceTransferIn: priceTransferIn || 0,
// priceTransferOut: priceTransferOut || 0,
// costBuyIn: object.costBuyIn || 0,
// costBuyOut: object.costBuyOut || 0,
// costSellIn: object.costSellIn || 0,
// costSellOut: object.costSellOut || 0,
// costRefillIn: object.costRefillIn || 0,
// costWriteOffOut: object.costWriteOffOut || 0,
// costTransferIn: object.costTransferIn || 0,
// costTransferOut: object.costTransferOut || 0,
