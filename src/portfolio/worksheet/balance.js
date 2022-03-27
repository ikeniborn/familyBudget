import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
export { Balance }

class Balance {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Balance')
  }

  updateBalance() {
    const newArrayOfObject = []
    const historicalPrices = new Portfolio().getWorkSheet('historicalPrices')
      .object
    const prices = new Portfolio().getWorkSheet('prices').object
    const contractors = new Portfolio().getWorkSheet('contractors').object
    const transactions = new Portfolio().getWorkSheet('transactions')
      .arrayOfObject
    const aggBalance = transactions.reduce((object, tx) => {
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
    }, {})
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
              newArrayOfObject.push({
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
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }
}
