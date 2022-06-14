import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
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
        [
          'd70311b68290664f7a442bfa8266dbb9',
          '0dc48f5ee42e5f36afa288473e6e1799',
          '4c110eef236fbdeffe3a353057692a58' /*liquidity pool (1), liquidity pool (2),liquidity pool (2)*/,
        ].indexOf(new Hash(row.service).md5) !== -1 &&
        new Hash(row.operation).md5 ===
          '0461ebd2b773878eac9f78a891912d65' /*'buy'*/ &&
        !row.isDelete
    )
    // console.log('transactionsLpToken', transactionsLpToken)
    const aggBalance = transactionsLpToken.reduce((object, tx) => {
      const positiveQuantity = tx.quantity < 0 ? tx.quantity * -1 : tx.quantity
      if (!object[tx.portfolio]) {
        object[tx.portfolio] = {}
      }
      if (!object[tx.portfolio]) {
        object[tx.portfolio] = {}
      }
      if (!object[tx.portfolio][tx.mainSymbol]) {
        object[tx.portfolio][tx.mainSymbol] = []
      }
      let part
      if (new Hash(tx.mainSymbol).md5 === new Hash(tx.symbol).md5) {
        part = 'main'
      } else {
        if (
          new Hash(tx.service).md5 ===
          'd70311b68290664f7a442bfa8266dbb9' /*liquidity pool (1)*/
        ) {
          part = 'one'
        } else if (
          new Hash(tx.service).md5 ===
          '0dc48f5ee42e5f36afa288473e6e1799' /*liquidity pool (2)*/
        ) {
          part = 'two'
        } else if (
          new Hash(tx.service).md5 ===
          '4c110eef236fbdeffe3a353057692a58' /*liquidity pool (3)*/
        ) {
          part = 'three'
        }
      }
      object[tx.portfolio][tx.mainSymbol].push({
        quantity: positiveQuantity,
        cost:
          new Hash(tx.mainSymbol).md5 === new Hash(tx.symbol).md5
            ? positiveQuantity * tx.price
            : 0,
        part: part,
        symbol: tx.symbol,
      })

      return object
    }, {})
    // console.log('aggBalance', aggBalance)
    const newArrayOfObject = []
    Object.entries(aggBalance).forEach(([portfolio, level0]) => {
      Object.entries(level0).forEach(([mainCoin, level1]) => {
        const aggMainCoin = level1.reduce((object, tx) => {
          if (!object[tx.part]) {
            object[tx.part] = {
              quantity: 0,
              cost: 0,
              symbol: tx.symbol || void 0,
            }
          }
          object[tx.part].quantity += tx.quantity
          object[tx.part].cost += tx.cost
          return object
        }, {})
        // console.log('aggMainCoin', aggMainCoin)
        let coeff = 1
        if (aggMainCoin?.two?.coin && !aggMainCoin?.three?.coin) {
          coeff = 2
        } else if (aggMainCoin?.two?.coin && aggMainCoin?.three?.coin) {
          coeff = 3
        }
        newArrayOfObject.push({
          rowKey: new Hash(portfolio + mainCoin).md5,
          portfolio: portfolio.toUpperCase(),
          mainSymbol: mainCoin.toUpperCase(),
          mainSymbolQty: aggMainCoin?.main?.quantity,
          mainSymbolHistoricalCost: aggMainCoin?.main?.cost,
          mainSymbolHistoricalPrice:
            aggMainCoin?.main?.cost / aggMainCoin?.main?.quantity,
          pairOneSymbol: aggMainCoin?.one?.symbol,
          pairOneQty: aggMainCoin?.one?.quantity,
          pairOnePrice:
            aggMainCoin?.main?.cost / coeff / aggMainCoin?.one?.quantity ||
            void 0,
          pairTwoSymbol: aggMainCoin?.two?.symbol,
          pairTwoQty: aggMainCoin?.two?.quantity,
          pairTwoPrice: aggMainCoin?.two?.symbol
            ? aggMainCoin?.main?.cost / coeff / aggMainCoin?.two?.quantity
            : void 0,
          pairThreeSymbol: aggMainCoin?.three?.symbol,
          pairThreeQty: aggMainCoin?.three?.quantity,
          pairThreePrice: aggMainCoin?.three?.symbol
            ? aggMainCoin?.three?.cost / coeff / aggMainCoin?.three?.quantity
            : void 0,
        })
      })
    })
    // console.log('newArrayOfObject', newArrayOfObject)
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }
}
