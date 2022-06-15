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
      const contractors = new Portfolio().getWorkSheet('Contractors').object
      const updateDataMart = new FormatDate()

      const aggFlow = new Transactions().workSheet.arrayOfObject
        .filter((row) => row.isDelete === false)
        .sort((a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        })
        .reduce((agg, tx) => {
          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }

          if (!agg[tx.account][tx.portfolio]) {
            agg[tx.account][tx.portfolio] = {}
          }

          if (!agg[tx.account][tx.portfolio][tx.overflow]) {
            agg[tx.account][tx.portfolio][tx.overflow] = {
              quantity: 0,
              priceCoefSum: 0,
            }
          }
          agg[tx.account][tx.portfolio][tx.overflow].quantity += tx.quantity
          agg[tx.account][tx.portfolio][tx.overflow].priceCoefSum +=
            tx.quantity * tx.priceCoef

          return agg
        }, {})

      let aggFlowArrayOfObject = []
      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([portfolio, level1]) => {
          Object.entries(level1).forEach(([overflow, object]) => {
            const quantityFlow = Math.round(object.quantity * 10000) / 10000
            const priceCoefFlow = object.priceCoefSum / quantityFlow
            if (quantityFlow > 0 && priceCoefFlow > 0) {
              //* доп. атрибуты
              //* атрибуты символа
              const overflowArray = overflow.split('/')
              const tokenA = overflowArray[0]
              const tokenB = overflowArray[1]
              const tokenAKey = new Hash(tokenA).md5
              const tokenACategory = symbols[tokenAKey]?.symbolCategory || ''
              const tokenAPrice = symbols[tokenAKey]?.price || ''
              const tokenBKey = new Hash(tokenB).md5
              const tokenBCategory = symbols[tokenBKey]?.symbolCategory || ''
              const tokenBPrice = symbols[tokenBKey]?.price || ''

              //* показатели
              const priceCoef = tokenAPrice / tokenBPrice
              const priceCoefDiff = priceCoef / priceCoefFlow - 1
              if (
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
              ) {
                aggFlowArrayOfObject.push({
                  account: account.toUpperCase(),
                  portfolio: portfolio.toUpperCase(),
                  overflow: overflow.toUpperCase(),
                  tokenA: tokenA.toUpperCase(),
                  tokenB: tokenB.toUpperCase(),
                  quantityFlow: quantityFlow,
                  priceCoefFlow: priceCoefFlow,
                  priceCoef: priceCoef,
                  priceCoefDiff: priceCoefDiff,
                  updateDataMart: updateDataMart.getFormatDate(
                    'yyyy-MM-dd hh:mm:ss'
                  ),
                })
              }
            }
          })
        })
      })

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject)
    } catch (error) {
      console.error('Overflows.updateOverflows', error.stack)
    }
  }
}
