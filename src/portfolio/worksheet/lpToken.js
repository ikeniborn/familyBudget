import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
export { LPToken }

class LPToken {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('LPToken')
  }

  updateLPToken() {
    const newArrayOfObject = []
    // const prices = new Portfolio().getWorkSheet('prices').object
    const transactionsLpToken = new Portfolio()
      .getWorkSheet('transactions')
      .arrayOfObject.filter(
        (row) =>
          ['liquidity pool (1)', 'liquidity pool (2)'].indexOf(row.service) !==
            -1 && row.operation === 'buy'
      )
    const aggBalance = transactionsLpToken.reduce((object, tx) => {
      const positiveQuantity = tx.quantity < 0 ? tx.quantity * -1 : tx.quantity
      if (!object[tx.account]) {
        object[tx.account] = {}
      }
      if (!object[tx.account][tx.project]) {
        object[tx.account][tx.project] = {}
      }
      if (!object[tx.account][tx.project][tx.mainCoin]) {
        object[tx.account][tx.project][tx.mainCoin] = {}
      }
      if (!object[tx.account][tx.project][tx.mainCoin][tx.coin]) {
        object[tx.account][tx.project][tx.mainCoin][tx.coin] = {
          quantity: 0,
          cost: 0,
          part: tx.mainCoin === tx.coin ? 'liquidity pool' : tx.service,
        }
      }
      if (tx.mainCoin === tx.coin) {
        object[tx.account][tx.project][tx.mainCoin][
          tx.coin
        ].quantity += positiveQuantity
        object[tx.account][tx.project][tx.mainCoin][tx.coin].cost +=
          positiveQuantity * tx.price
        object[tx.account][tx.project][tx.mainCoin][tx.coin].cost +=
          positiveQuantity * tx.price
      } else {
        object[tx.account][tx.project][tx.mainCoin][
          tx.coin
        ].quantity += positiveQuantity
      }

      return object
    }, {})
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([project, level1]) => {
        Object.entries(level1).forEach(([mainCoin, level2]) => {
          newArrayOfObject.push({
            account: account.toUpperCase(),
            project: project.toUpperCase(),
            mainCoin: mainCoin.toUpperCase(),
            level2: Object.entries(level2),
          })
          // Object.entries(level2).forEach(([coin, level3]) => {
          //   const quantityRound = Math.round(level3.quantity * 1000) / 1000
          //   if (mainCoin !== coin)
          //     if (quantityRound) {
          //       newArrayOfObject.push({
          //         account: account.toUpperCase(),
          //         contractor: contractor.toUpperCase(),
          //         project: project.toUpperCase(),
          //         mainCoin: mainCoin.toUpperCase(),
          //         coin: coin.toUpperCase(),
          //         coinType: coinType.toUpperCase(),
          //         risk: risk.toUpperCase(),
          //         quantity: quantityRound,
          //         historicalCostBuy,
          //         historicalCostAvg,
          //         currentCost,
          //       })
          //     }
          // })
        })
      })
    })
    console.log(JSON.stringify(aggBalance))
    // this.workSheet.truncateInsertRows(newArrayOfObject)
  }
}
