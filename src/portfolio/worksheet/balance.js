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
    const aggBalance = new Portfolio()
      .getWorkSheet('transactions')
      .arrayOfObject.filter((row) => !row.isDelete)
      .reduce((object, tx) => {
        if (!object[tx.account]) {
          object[tx.account] = {}
        }
        if (!object[tx.account][tx.contractor]) {
          object[tx.account][tx.contractor] = {}
        }
        if (!object[tx.account][tx.contractor][tx.service]) {
          object[tx.account][tx.contractor][tx.service] = {}
        }
        if (!object[tx.account][tx.contractor][tx.service][tx.project]) {
          object[tx.account][tx.contractor][tx.service][tx.project] = {}
        }
        if (
          !object[tx.account][tx.contractor][tx.service][tx.project][tx.coin]
        ) {
          object[tx.account][tx.contractor][tx.service][tx.project][tx.coin] = 0
        }
        object[tx.account][tx.contractor][tx.service][tx.project][tx.coin] +=
          tx.quantity
        return object
      }, {})
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([contractor, level1]) => {
        Object.entries(level1).forEach(([service, level2]) => {
          Object.entries(level2).forEach(([project, level3]) => {
            Object.entries(level3).forEach(([coin, quantity]) => {
              const quantityRound = Math.round(quantity * 1000) / 1000
              if (quantityRound) {
                const currentCost =
                  quantityRound * prices[new Hash(coin).md5]?.price
                const coinType = prices[new Hash(coin).md5]?.coinType
                const historicalCostBuy =
                  quantityRound *
                    historicalPrices[new Hash(account + project + coin).md5]
                      ?.priceBuy || 0
                const historicalCostAvg =
                  quantityRound *
                    historicalPrices[new Hash(account + project + coin).md5]
                      ?.priceAvg || 0
                const risk = prices[new Hash(coin).md5]?.risk
                newArrayOfObject.push({
                  account: account.toUpperCase(),
                  contractor: contractor.toUpperCase(),
                  contractorType: contractors[
                    new Hash(contractor).md5
                  ].type.toUpperCase(),
                  service: service.toUpperCase(),
                  project: project.toUpperCase(),
                  coin: coin.toUpperCase(),
                  coinType: coinType.toUpperCase(),
                  risk: risk.toUpperCase(),
                  quantity: quantityRound,
                  historicalCostBuy,
                  historicalCostAvg,
                  currentCost,
                })
              }
            })
          })
        })
      })
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }
}
