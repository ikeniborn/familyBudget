import { Portfolio } from '../spreadsheet/portfolio'
import { Transactions } from './transactions'
import { HistoricalPrices } from './historicalPrices'
import { Contractors } from './contractors'
import { Prices } from './prices'
import { Hash } from '../../utils'
export { Balance }

class Balance {
  constructor(range) {
    this.workSheet = new Portfolio().getWorkSheet('Balance', range, 1)
  }

  updateBalance() {
    const historicalPrices = new HistoricalPrices().values
    const prices = new Prices().values
    const contractors = new Contractors().values
    const aggBalance = Object.values(new Transactions().values).reduce(
      (object, tx) => {
        if (!object[tx.account]) {
          object[tx.account] = {}
        }
        if (!object[tx.account][tx.contractor]) {
          object[tx.account][tx.contractor] = {}
        }
        if (!object[tx.account][tx.contractor][tx.project]) {
          object[tx.account][tx.contractor][tx.project] = {}
        }
        if (!object[tx.account][tx.contractor][tx.project][tx.coin]) {
          object[tx.account][tx.contractor][tx.project][tx.coin] = 0
        }
        object[tx.account][tx.contractor][tx.project][tx.coin] += tx.quantity
        return object
      },
      {}
    )
    const balance = []
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([contractor, level1]) => {
        Object.entries(level1).forEach(([project, level2]) => {
          Object.entries(level2).forEach(([coin, quantity]) => {
            if (quantity) {
              const currentCost = quantity * prices[new Hash(coin).md5]?.price
              const historicalCostBuy =
                quantity *
                  historicalPrices[new Hash(account + project + coin).md5]
                    ?.priceBuy || 0
              const historicalCostAvg =
                quantity *
                  historicalPrices[new Hash(account + project + coin).md5]
                    ?.priceAvg || 0
              const risk = prices[new Hash(coin).md5]?.risk
              balance.push({
                account: account.toUpperCase(),
                contractor: contractor.toUpperCase(),
                contractorType: contractors[
                  new Hash(contractor).md5
                ].type.toUpperCase(),
                project: project.toUpperCase(),
                coin: coin.toUpperCase(),
                risk: risk.toUpperCase(),
                quantity,
                historicalCostBuy,
                historicalCostAvg,
                currentCost,
              })
            }
          })
        })
      })
    })
    this.workSheet.insertRows(balance, this.head)
  }
}
