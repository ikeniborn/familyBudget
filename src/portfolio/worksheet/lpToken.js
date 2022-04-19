import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import { Log } from './log'
import { Transactions } from './transactions'
export { LPToken }

class LPToken {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('LPToken')
  }

  updateLPToken() {
    const transactionsLpToken = new Transactions().workSheet.arrayOfObject.filter(
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
        object[tx.account][tx.project][tx.mainCoin] = []
      }
      let part
      if (tx.mainCoin === tx.coin) {
        part = 'main'
      } else {
        if (tx.service === 'liquidity pool (1)') {
          part = 'one'
        } else {
          part = 'two'
        }
      }
      object[tx.account][tx.project][tx.mainCoin].push({
        quantity: positiveQuantity,
        cost: tx.mainCoin === tx.coin ? positiveQuantity * tx.price : 0,
        part: part,
        coin: tx.coin,
      })

      return object
    }, {})
    const newArrayOfObject = []
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([project, level1]) => {
        Object.entries(level1).forEach(([mainCoin, level2]) => {
          const aggMainCoin = level2.reduce((object, tx) => {
            if (!object[tx.part]) {
              object[tx.part] = {
                quantity: 0,
                cost: 0,
                coin: tx.coin,
              }
            }
            object[tx.part].quantity += tx.quantity
            object[tx.part].cost += tx.cost
            return object
          }, {})

          newArrayOfObject.push({
            account: account.toUpperCase(),
            project: project.toUpperCase(),
            mainCoin: mainCoin.toUpperCase(),
            mainCoinQty: aggMainCoin.main.quantity,
            mainCoinHistoricalCost: aggMainCoin.main.cost,
            pairOneCoin: aggMainCoin.one.coin,
            pairOneQty: aggMainCoin.one.quantity,
            pairOnePrice: aggMainCoin.main.cost / 2 / aggMainCoin.one.quantity,
            pairTwoCoin: aggMainCoin.two.coin,
            pairTwoQty: aggMainCoin.two.quantity,
            pairTwoPrice: aggMainCoin.main.cost / 2 / aggMainCoin.two.quantity,
          })
        })
      })
    })
    // console.log(newArrayOfObject)
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }
}
