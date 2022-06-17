import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate, FormatObject } from '../../utils'
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
        .filter((rowObject) => {
          const overflowArray = rowObject.overflow.split('/')
          const tokenA = overflowArray[0]
          const tokenB = overflowArray[1]
          const tokenAKey = new Hash(tokenA).md5
          const tokenACategory = symbols[tokenAKey]?.symbolCategory || ''
          const tokenBKey = new Hash(tokenB).md5
          const tokenBCategory = symbols[tokenBKey]?.symbolCategory || ''
          return (
            rowObject.isDelete === false &&
            [
              '4300a88e74641d7d783fbfb093d1f6ed' /*LP Token*/,
              'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
              '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
            ].indexOf(new Hash(tokenACategory).md5) === -1 &&
            [
              '4300a88e74641d7d783fbfb093d1f6ed' /*LP Token*/,
              'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
              '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
            ].indexOf(new Hash(tokenBCategory).md5) === -1 &&
            tokenAKey !== tokenBKey
          )
        })
        .sort((a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        })
      const aggOverflow = transactions.reduce((agg, tx) => {
        const operationKey = new Hash(tx.operation).md5
        const directionKey = new Hash(tx.direction).md5
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
          }
        }

        //* Распределение количества по потокам

        if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityBuyIn += tx.quantity
            agg[tx.account][overflow][tx.symbol].priceCoefSumBuyIn +=
              tx.priceCoef * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityBuyOut +=
              tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].priceCoefSumBuyOut +=
              tx.priceCoef * tx.quantity * -1
          }
        } else if (
          operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantitySellIn += tx.quantity
            agg[tx.account][overflow][tx.symbol].priceCoefSumSellIn +=
              tx.priceCoef * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantitySellOut +=
              tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].priceCoefSumSellOut +=
              tx.priceCoef * tx.quantity * -1
          }
        } else if (
          operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityRefillIn += tx.quantity
            agg[tx.account][overflow][tx.symbol].priceCoefSumRefillIn +=
              tx.priceCoef * tx.quantity
          }
        } else if (
          operationKey === '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
        ) {
          if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityWriteOffOut +=
              tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].priceCoefSumWriteOffOut +=
              tx.priceCoef * tx.quantity * -1
          }
        } else if (
          operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityTransferIn +=
              tx.quantity
            agg[tx.account][overflow][tx.symbol].priceCoefSumTransferIn +=
              tx.priceCoef * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityTransferOut +=
              tx.quantity * -1
            agg[tx.account][overflow][tx.symbol].priceCoefSumTransferOut +=
              tx.priceCoef * tx.quantity * -1
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

      // console.log(
      //   'aggOverflow dot/ksm',
      //   Object.values(aggOverflow)[0]['dot/ksm']
      // )
      // console.log(
      //   'aggOverflow ksm/dot',
      //   Object.values(aggOverflow)[0]['ksm/dot']
      // )

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

            //* показатели
            const quantityFlow = object.quantityFlow
            const priceCoefSumInFlow = priceCoefSumIn / quantityInFlow || 0
            const priceCoefSumOutFlow = priceCoefSumOut / quantityOutFlow || 0
            const priceCoefSumFlowSum =
              priceCoefSumInFlow * quantityInFlow +
              priceCoefSumOutFlow * quantityOutFlow
            const quantityFlowSum = quantityInFlow + quantityOutFlow
            const priceCoefFlow = priceCoefSumFlowSum / quantityFlowSum
            //* атрибуты перелива
            // const overflowArray = overflow.split('/')
            // const tokenA = overflowArray[0]
            // const tokenB = overflowArray[1]
            // const overflowRev = tokenB + '/' + tokenA

            if (!aggFlowObject[account]) {
              aggFlowObject[account] = {}
            }

            if (!aggFlowObject[account][overflow]) {
              aggFlowObject[account][overflow] = {
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
          const overflowRev = tokenB + '/' + tokenA
          const ABPriceCoef = object.tokenAPrice / object.tokenBPrice
          const ABPriceCoefDiffPct = ABPriceCoef / object.ABPriceCoefFlow - 1
          const BAPriceCoef = object.tokenBPrice / object.tokenAPrice
          const BAPriceCoefDiffPct = BAPriceCoef / object.BAPriceCoefFlow - 1
          if (ABPriceCoefDiffPct < -0.05) {
            overflowStatus = 'It is possible to do reverse'
          } else if (ABPriceCoefDiffPct < -0.1) {
            overflowStatus = 'Do a backflow'
          } else if (ABPriceCoefDiffPct < 0) {
            overflowStatus = 'Wait'
          } else {
            overflowStatus = 'Do nothing'
          }
          aggFlowArrayOfObject.push({
            account: account.toUpperCase(),
            overflow: overflow.toUpperCase(),
            overflowRev: overflowRev.toUpperCase(),
            tokenA: object.tokenA ? object.tokenA.toUpperCase() : void 0,
            tokenARest: object.tokenARest,
            tokenAQuantityFlow: object.tokenAQuantityFlow,
            tokenB: object.tokenB ? object.tokenB.toUpperCase() : void 0,
            tokenBRest: object.tokenBRest,
            tokenBQuantityFlow: object.tokenBQuantityFlow,
            ABPriceCoefFlow: object.ABPriceCoefFlow,
            ABPriceCoef: ABPriceCoef,
            ABPriceCoefDiffPct: ABPriceCoefDiffPct,
            BAPriceCoefFlow: object.BAPriceCoefFlow,
            BAPriceCoef: BAPriceCoef,
            BAPriceCoefDiffPct: BAPriceCoefDiffPct,
            overflowStatus: overflowStatus,
            updateDataMart: updateDataMart.getFormatDate('yyyy-MM-dd hh:mm:ss'),
          })
        })
      })

      // console.log(aggFlowObject['ikeniborn']['dot/ksm'])
      const sortAggFlowArrayOfObject = aggFlowArrayOfObject
        .filter((rowObject) => {
          return (
            Math.round(rowObject.tokenARest * 100) / 100 !== 0 &&
            Math.round(rowObject.tokenBRest * 100) / 100 !== 0
          )
        })
        .sort((a, b) => {
          return (
            ('' + a.overflow).localeCompare(b.overflow) &&
            ('' + a.overflowRev).localeCompare(b.overflowRev)
          )
        })
      this.workSheet.truncateInsertRows(sortAggFlowArrayOfObject)
    } catch (error) {
      console.error('Overflows.updateOverflows', error.stack)
    }
  }
}
