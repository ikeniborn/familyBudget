import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
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

        if (!agg[tx.account][tx.overflow]) {
          agg[tx.account][tx.overflow] = {}
        }

        if (!agg[tx.account][tx.overflow][tx.symbol]) {
          agg[tx.account][tx.overflow][tx.symbol] = {
            quantityBuyIn: 0,
            quantityBuyOut: 0,
            quantitySellIn: 0,
            quantitySellOut: 0,
            quantityRefillIn: 0,
            quantityWriteOffOut: 0,
            quantityTransferIn: 0,
            quantityTransferOut: 0,
            quantityFlow: 0,
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
            agg[tx.account][tx.overflow][tx.symbol].quantityBuyIn += tx.quantity
            agg[tx.account][tx.overflow][tx.symbol].priceCoefSumBuyIn +=
              tx.priceCoef * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][tx.overflow][tx.symbol].quantityBuyOut +=
              tx.quantity * -1
            agg[tx.account][tx.overflow][tx.symbol].priceCoefSumBuyOut +=
              tx.priceCoef * tx.quantity * -1
          }
        } else if (
          operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][tx.overflow][tx.symbol].quantitySellIn +=
              tx.quantity
            agg[tx.account][tx.overflow][tx.symbol].priceCoefSumSellIn +=
              tx.priceCoef * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][tx.overflow][tx.symbol].quantitySellOut +=
              tx.quantity * -1
            agg[tx.account][tx.overflow][tx.symbol].priceCoefSumSellOut +=
              tx.priceCoef * tx.quantity * -1
          }
        } else if (
          operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][tx.overflow][tx.symbol].quantityRefillIn +=
              tx.quantity
            agg[tx.account][tx.overflow][tx.symbol].priceCoefSumRefillIn +=
              tx.priceCoef * tx.quantity
          }
        } else if (
          operationKey === '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
        ) {
          if (directionKey === outKey) {
            agg[tx.account][tx.overflow][tx.symbol].quantityWriteOffOut +=
              tx.quantity * -1
            agg[tx.account][tx.overflow][tx.symbol].priceCoefSumWriteOffOut +=
              tx.priceCoef * tx.quantity * -1
          }
        } else if (
          operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][tx.overflow][tx.symbol].quantityTransferIn +=
              tx.quantity
            agg[tx.account][tx.overflow][tx.symbol].priceCoefSumTransferIn +=
              tx.priceCoef * tx.quantity
          } else if (directionKey === outKey) {
            agg[tx.account][tx.overflow][tx.symbol].quantityTransferOut +=
              tx.quantity * -1
            agg[tx.account][tx.overflow][tx.symbol].priceCoefSumTransferOut +=
              tx.priceCoef * tx.quantity * -1
          }
        }

        agg[tx.account][tx.overflow][tx.symbol].quantityFlow += tx.quantity

        return agg
      }, {})

      transactions.forEach((tx) => {
        if (aggOverflow[tx.account]) {
          if (aggOverflow[tx.account][tx.overflowRev]) {
            if (aggOverflow[tx.account][tx.overflowRev][tx.symbol]) {
              const operationKey = new Hash(tx.operation).md5
              const directionKey = new Hash(tx.direction).md5

              //* Распределение количества по потокам

              if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
                if (directionKey === inKey) {
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].quantityBuyIn += tx.quantity
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].priceCoefSumBuyIn += tx.priceCoef * tx.quantity
                } else if (directionKey === outKey) {
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].quantityBuyOut += tx.quantity * -1
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].priceCoefSumBuyOut += tx.priceCoef * tx.quantity * -1
                }
              } else if (
                operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
              ) {
                if (directionKey === inKey) {
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].quantitySellIn += tx.quantity
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].priceCoefSumSellIn += tx.priceCoef * tx.quantity
                } else if (directionKey === outKey) {
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].quantitySellOut += tx.quantity * -1
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].priceCoefSumSellOut += tx.priceCoef * tx.quantity * -1
                }
              } else if (
                operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
              ) {
                if (directionKey === inKey) {
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].quantityRefillIn += tx.quantity
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].priceCoefSumRefillIn += tx.priceCoef * tx.quantity
                }
              } else if (
                operationKey ===
                '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
              ) {
                if (directionKey === outKey) {
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].quantityWriteOffOut += tx.quantity * -1
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].priceCoefSumWriteOffOut += tx.priceCoef * tx.quantity * -1
                }
              } else if (
                operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
              ) {
                if (directionKey === inKey) {
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].quantityTransferIn += tx.quantity
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].priceCoefSumTransferIn += tx.priceCoef * tx.quantity
                } else if (directionKey === outKey) {
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].quantityTransferOut += tx.quantity * -1
                  aggOverflow[tx.account][tx.overflowRev][
                    tx.symbol
                  ].priceCoefSumTransferOut += tx.priceCoef * tx.quantity * -1
                }
              }

              aggOverflow[tx.account][tx.overflowRev][tx.symbol].quantityFlow +=
                tx.quantity
            }
          }
        }
      })

      // console.log(
      //   'aggOverflow',
      //   'ROSE/KAVA',
      //   aggOverflow['ikeniborn']['rose/kava']
      // )

      let aggFlowArrayOfObject = []
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
            const overflowArray = overflow.split('/')
            const tokenA = overflowArray[0]
            const tokenB = overflowArray[1]
            const tokenAKey = new Hash(tokenA).md5
            const tokenAPrice = symbols[tokenAKey]?.price || ''
            const tokenBKey = new Hash(tokenB).md5
            const tokenBPrice = symbols[tokenBKey]?.price || ''
            const priceCoef = tokenAPrice / tokenBPrice
            const priceCoefDiff = priceCoef - priceCoefFlow
            const priceCoefDiffPst = priceCoef / priceCoefFlow - 1
            const overflowRev = tokenB + '/' + tokenA
            const priceCoefRev = tokenBPrice / tokenAPrice

            // if (
            //   new Hash(tokenA + '/' + tokenB).md5 ===
            //     new Hash('ROSE/KAVA').md5 &&
            //   new Hash(account).md5 === new Hash('IKENIBORN').md5
            // ) {
            //   console.log(account, symbol)
            //   console.log('quantityFlow', quantityFlow)
            //   console.log('priceCoefSumInFlow', priceCoefSumInFlow)
            //   console.log('priceCoefSumOutFlow', priceCoefSumOutFlow)
            //   console.log('priceCoefSumFlowSum', priceCoefSumFlowSum)
            //   console.log('quantityFlowSum', quantityFlowSum)
            //   console.log('priceCoefFlow', priceCoefFlow)
            //   console.log('overflow', overflow)
            //   console.log('priceCoef', priceCoef)
            //   console.log('priceCoefDiff', priceCoefDiff)
            //   console.log('priceCoefDiffPst', priceCoefDiffPst)
            //   console.log('overflowRev', overflowRev)
            //   console.log('priceCoefRev', priceCoefRev)
            // }

            // if (
            //   [
            //     '4300a88e74641d7d783fbfb093d1f6ed' /*LP Token*/,
            //     'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
            //     '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
            //   ].indexOf(new Hash(tokenACategory).md5) === -1 &&
            //   [
            //     '4300a88e74641d7d783fbfb093d1f6ed' /*LP Token*/,
            //     'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
            //     '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
            //   ].indexOf(new Hash(tokenBCategory).md5) === -1 &&
            //   tokenAKey !== tokenBKey
            // ) {

            aggFlowArrayOfObject.push({
              account: account.toUpperCase(),
              overflow: overflow.toUpperCase(),
              overflowRev: overflowRev.toUpperCase(),
              symbol: symbol.toUpperCase(),
              quantityFlow: quantityFlow,
              priceCoefFlow: priceCoefFlow,
              priceCoef: priceCoef,
              priceCoefDiff: priceCoefDiff,
              priceCoefDiffPst: priceCoefDiffPst,
              priceCoefRev: priceCoefRev,
              updateDataMart: updateDataMart.getFormatDate(
                'yyyy-MM-dd hh:mm:ss'
              ),
            })
            // }
          })
        })
      })

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject)
    } catch (error) {
      console.error('Overflows.updateOverflows', error.stack)
    }
  }
}
