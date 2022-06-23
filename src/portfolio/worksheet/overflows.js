import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate, FormatArray } from '../../utils'
import { Symbols } from './symbols'
import { Transactions } from './transactions'
export { Overflows }

class Overflows {
  constructor(workSheet = '') {
    if (Overflows.exists) {
      return Overflows.instance
    }
    Overflows.instance = this
    Overflows.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Overflows')
  }

  updateOverflows() {
    try {
      const symbols = new Symbols().workSheet.object
      const updateDataMart = new FormatDate()
      const inKey = new Hash('in').md5
      const outKey = new Hash('out').md5
      const transactions = new Transactions().workSheet.arrayOfObject
      const transactionsOverflows = new FormatArray(transactions)
        .getCopy()
        .filter((rowObject) => {
          return rowObject.isDelete === false && rowObject.isOverflow === true
        })

      const transactionsFlow = new FormatArray(transactions)
        .getCopy()
        .filter((rowObject) => {
          return rowObject.isDelete === false && rowObject.isLock === false
        })

      const aggFlow = transactionsFlow.reduce((agg, tx) => {
        if (!agg[tx.account]) {
          agg[tx.account] = {}
        }
        if (!agg[tx.account][tx.symbol]) {
          agg[tx.account][tx.symbol] = {
            quantityRest: 0,
          }
        }
        agg[tx.account][tx.symbol].quantityRest += tx.quantity
        return agg
      }, {})

      const aggOverflow = transactionsOverflows.reduce((agg, tx) => {
        const operationKey = new Hash(tx.operation).md5
        const directionKey = new Hash(tx.direction).md5
        const dayInOverflow = new FormatDate().diffBetweenDate(tx.dateTime)
        if (!agg[tx.account]) {
          agg[tx.account] = {}
        }
        let overflow
        if (outKey === directionKey) {
          overflow = tx.overflow
        } else if (inKey === directionKey) {
          overflow = tx.overflowRev
        }
        if (!agg[tx.account][overflow]) {
          agg[tx.account][overflow] = {}
        }

        if (!agg[tx.account][overflow][tx.symbol]) {
          agg[tx.account][overflow][tx.symbol] = {
            quantityBuyIn: 0,
            quantityBuyOut: 0,
            quantitySellIn: 0,
            quantitySellOut: 0,
            quantityRefillIn: 0,
            quantityWriteOffOut: 0,
            quantityTransferIn: 0,
            quantityTransferOut: 0,
            quantityFlow: 0,
            quantityRest: 0,
            priceCoefSumBuyIn: 0,
            priceCoefSumBuyOut: 0,
            priceCoefSumSellIn: 0,
            priceCoefSumSellOut: 0,
            priceCoefSumRefillIn: 0,
            priceCoefSumWriteOffOut: 0,
            priceCoefSumTransferIn: 0,
            priceCoefSumTransferOut: 0,
            dayInOverflowBuyInSum: 0,
            dayInOverflowBuyOutSum: 0,
            dayInOverflowSellOutSum: 0,
            dayInOverflowSellInSum: 0,
            dayInOverflowRefillInSum: 0,
            dayInOverflowWriteOffOutSum: 0,
            dayInOverflowTransferInSum: 0,
            dayInOverflowTransferOutSum: 0,
          }
        }

        //* Распределение количества по потокам

        if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityBuyIn += tx.quantity
            agg[tx.account][overflow][tx.symbol].priceCoefSumBuyIn +=
              tx.priceCoef * tx.quantity
            agg[tx.account][overflow][tx.symbol].dayInOverflowBuyInSum +=
              dayInOverflow * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityBuyOut +=
              tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].priceCoefSumBuyOut +=
              tx.priceCoef * tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].dayInOverflowBuyOutSum +=
              dayInOverflow * tx.quantity * -1
          }
        } else if (
          operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantitySellIn += tx.quantity
            agg[tx.account][overflow][tx.symbol].priceCoefSumSellIn +=
              tx.priceCoef * tx.quantity
            agg[tx.account][overflow][tx.symbol].dayInOverflowSellInSum +=
              dayInOverflow * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantitySellOut +=
              tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].priceCoefSumSellOut +=
              tx.priceCoef * tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].dayInOverflowSellOutSum +=
              dayInOverflow * tx.quantity * -1
          }
        } else if (
          operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityRefillIn += tx.quantity
            agg[tx.account][overflow][tx.symbol].priceCoefSumRefillIn +=
              tx.priceCoef * tx.quantity
            agg[tx.account][overflow][tx.symbol].dayInOverflowRefillInSum +=
              dayInOverflow * tx.quantity
          }
        } else if (
          operationKey === '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
        ) {
          if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityWriteOffOut +=
              tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].priceCoefSumWriteOffOut +=
              tx.priceCoef * tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].dayInOverflowWriteOffOutSum +=
              dayInOverflow * tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].dayInOverflowWriteOffOutSum +=
              dayInOverflow * tx.quantity * -1
          }
        } else if (
          operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityTransferIn +=
              tx.quantity
            agg[tx.account][overflow][tx.symbol].priceCoefSumTransferIn +=
              tx.priceCoef * tx.quantity
            agg[tx.account][overflow][tx.symbol].dayInOverflowTransferInSum +=
              dayInOverflow * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityTransferOut +=
              tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].priceCoefSumTransferOut +=
              tx.priceCoef * tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].dayInOverflowTransferOutSum +=
              dayInOverflow * tx.quantity * -1
          }
        }

        agg[tx.account][overflow][tx.symbol].quantityFlow += tx.quantity
        agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity

        return agg
      }, {})

      transactions.forEach((tx) => {
        let overflow
        const directionKey = new Hash(tx.direction).md5
        if (outKey === directionKey) {
          overflow = tx.overflowRev
        } else if (inKey === directionKey) {
          overflow = tx.overflow
        }
        if (aggOverflow[tx.account]) {
          if (aggOverflow[tx.account][overflow]) {
            if (aggOverflow[tx.account][overflow][tx.symbol]) {
              aggOverflow[tx.account][overflow][tx.symbol].quantityRest +=
                tx.quantity
            }
          }
        }
      })

      const aggFlowObject = {}
      Object.entries(aggOverflow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([overflow, level1]) => {
          Object.entries(level1).forEach(([symbol, object]) => {
            //* расчет потоков
            const priceCoefSumIn =
              object.priceCoefSumBuyIn +
              object.priceCoefSumSellIn +
              object.priceCoefSumRefillIn +
              object.priceCoefSumTransferIn

            const priceCoefSumOut =
              object.priceCoefSumBuyOut +
              object.priceCoefSumSellOut +
              object.priceCoefSumWriteOffOut +
              object.priceCoefSumTransferOut

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

            //* Расчет среднего времени в портфеле

            const dayInOverflowAvg =
              object.dayInOverflowBuyInSum / object.quantityBuyIn ||
              0 + object.dayInOverflowSellInSum / object.quantitySellIn ||
              0 + object.dayInOverflowRefillInSum / object.quantityRefillIn ||
              0 +
                object.dayInOverflowTransferInSum / object.quantityTransferIn ||
              -(
                object.dayInOverflowBuyOutSum / object.quantityBuyOut ||
                0 + object.dayInOverflowSellOutSum / object.quantitySellOut ||
                0 +
                  object.dayInOverflowWriteOffOutSum /
                    object.quantityWriteOffOut ||
                0 +
                  object.dayInOverflowTransferOutSum /
                    object.quantityTransferOut ||
                0
              )

            //* показатели
            const quantityFlow = object.quantityFlow
            const priceCoefSumInFlow = priceCoefSumIn / quantityInFlow || 0
            const priceCoefSumOutFlow = priceCoefSumOut / quantityOutFlow || 0
            const priceCoefSumFlowSum =
              priceCoefSumInFlow * quantityInFlow +
              priceCoefSumOutFlow * quantityOutFlow
            const quantityFlowSum = quantityInFlow + quantityOutFlow
            const priceCoefFlow = priceCoefSumFlowSum / quantityFlowSum

            if (!aggFlowObject[account]) {
              aggFlowObject[account] = {}
            }

            if (!aggFlowObject[account][overflow]) {
              aggFlowObject[account][overflow] = {
                dayInOverflowAvg: Math.abs(dayInOverflowAvg),
                tokenA: '',
                tokenARest: 0,
                tokenAQuantityFlow: 0,
                ABPriceCoefFlow: 0,
                tokenAPrice: 0,
                tokenB: '',
                tokenBRest: 0,
                tokenBQuantityFlow: 0,
                BAPriceCoefFlow: 0,
                tokenBPrice: 0,
              }
            }

            if (quantityFlow < 0) {
              const tokenAKey = new Hash(symbol).md5
              aggFlowObject[account][overflow].tokenA = symbol
              aggFlowObject[account][overflow].tokenARest = object.quantityRest
              aggFlowObject[account][overflow].tokenAQuantityFlow = quantityFlow
              aggFlowObject[account][overflow].ABPriceCoefFlow = priceCoefFlow
              aggFlowObject[account][overflow].tokenAPrice =
                symbols[tokenAKey]?.price || 0
            }

            if (quantityFlow > 0) {
              const tokenBKey = new Hash(symbol).md5
              aggFlowObject[account][overflow].tokenB = symbol
              aggFlowObject[account][overflow].tokenBRest = object.quantityRest
              aggFlowObject[account][overflow].tokenBQuantityFlow = quantityFlow
              aggFlowObject[account][overflow].BAPriceCoefFlow = priceCoefFlow
              aggFlowObject[account][overflow].tokenBPrice =
                symbols[tokenBKey]?.price || 0
            }
          })
        })
      })
      const aggFlowArrayOfObject = []
      Object.entries(aggFlowObject).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([overflow, object]) => {
          let overflowStatus
          const overflowArray = overflow.split('/')
          const tokenA = overflowArray[0]
          const tokenB = overflowArray[1]
          const tokenAKey = new Hash(overflowArray[0]).md5
          const tokenBKey = new Hash(overflowArray[1]).md5
          const backflow = tokenB + '/' + tokenA
          const ABPriceCoef = object.tokenAPrice / object.tokenBPrice
          const ABPriceCoefDiffPct = object.ABPriceCoefFlow
            ? ABPriceCoef / object.ABPriceCoefFlow - 1
            : 0
          const BAPriceCoef = object.tokenBPrice / object.tokenAPrice
          const BAPriceCoefDiffPct = object.BAPriceCoefFlow
            ? BAPriceCoef / object.BAPriceCoefFlow - 1
            : 0
          const tokenARest = aggFlow[account][object.tokenA]?.quantityRest || 0
          const tokenBRest = aggFlow[account][object.tokenB]?.quantityRest || 0

          if (tokenBRest >= object.tokenBQuantityFlow) {
            if (ABPriceCoefDiffPct < -0.05) {
              overflowStatus = '1 Do a backflow'
            } else if (ABPriceCoefDiffPct > 0.05 && tokenARest > 0) {
              overflowStatus = '2 Do a overflow'
            } else {
              overflowStatus = '3 Wait'
            }
          } else {
            overflowStatus = '4 Do nothing'
          }

          if (
            symbols[tokenAKey]?.useInReport === true &&
            symbols[tokenBKey]?.useInReport === true
          ) {
            aggFlowArrayOfObject.push({
              account: account.toUpperCase(),
              dayInOverflowAvg: object.dayInOverflowAvg,
              overflow: overflow.toUpperCase(),
              backflow: backflow.toUpperCase(),
              tokenA: object.tokenA ? object.tokenA.toUpperCase() : void 0,
              tokenARest: tokenARest,
              tokenAQuantityFlow: object.tokenAQuantityFlow,
              tokenB: object.tokenB ? object.tokenB.toUpperCase() : void 0,
              tokenBRest: tokenBRest,
              tokenBQuantityFlow: object.tokenBQuantityFlow,
              ABPriceCoefFlow: object.ABPriceCoefFlow,
              ABPriceCoef: ABPriceCoef,
              ABPriceCoefDiffPct: ABPriceCoefDiffPct,
              BAPriceCoefFlow: object.BAPriceCoefFlow,
              BAPriceCoef: BAPriceCoef,
              BAPriceCoefDiffPct: BAPriceCoefDiffPct,
              overflowStatus: overflowStatus,
              updateDataMart: updateDataMart.getFormatDate(
                'yyyy-MM-dd hh:mm:ss'
              ),
            })
          }
        })
      })

      const sortAggFlowArrayOfObject = aggFlowArrayOfObject
        // .sort((a, b) => {
        //   return ('' + a.overflowOrder + a.ABPriceCoefDiffPct).localeCompare(
        //     '' + b.overflowOrder + b.ABPriceCoefDiffPct
        //   )
        // })
        .sort((a, b) => {
          return a.ABPriceCoefDiffPct - b.ABPriceCoefDiffPct
        })
      // .sort((a, b) => {
      //   return (
      //     ('' + a.overflow).localeCompare(b.overflow) &&
      //     ('' + a.overflowRev).localeCompare(b.overflowRev)
      //   )
      // })
      this.workSheet.truncateInsertRows(sortAggFlowArrayOfObject)
    } catch (error) {
      console.error('Overflows.updateOverflows', error.stack)
    }
  }
}
