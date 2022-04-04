import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import { Log } from './log'
export { Balance }

class Balance {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Balance')
  }

  truncateInsertBalance() {
    try {
      const newArrayOfObject = []
      const historicalPricesAvg = new Portfolio().getWorkSheet(
        'historicalPricesAvg'
      ).object
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
            !object[tx.account][tx.contractor][tx.service][tx.project][
              tx.symbol
            ]
          ) {
            object[tx.account][tx.contractor][tx.service][tx.project][
              tx.symbol
            ] = 0
          }
          object[tx.account][tx.contractor][tx.service][tx.project][
            tx.symbol
          ] += tx.quantity
          return object
        }, {})
      Object.entries(aggBalance).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          Object.entries(level1).forEach(([service, level2]) => {
            Object.entries(level2).forEach(([project, level3]) => {
              Object.entries(level3).forEach(([symbol, quantity]) => {
                let newService
                const quantityRound = Math.round(quantity * 1000) / 1000
                if (quantityRound) {
                  const currentCost =
                    quantityRound * prices[new Hash(symbol).md5]?.price
                  const symbolType =
                    prices[new Hash(symbol).md5]?.symbolType.toUpperCase() ||
                    void 0
                  const historicalCostBuy =
                    quantityRound *
                      historicalPricesAvg[
                        new Hash(account + project + symbol).md5
                      ]?.priceBuy || 0
                  const historicalCostAvg =
                    quantityRound *
                      historicalPricesAvg[
                        new Hash(account + project + symbol).md5
                      ]?.priceAvg || 0
                  const risk =
                    prices[new Hash(symbol).md5]?.risk.toUpperCase() || void 0

                  if (
                    [('Liquidity pool (1)', 'Liquidity pool (2)')].indexOf(
                      service
                    ) !== -1
                  ) {
                    newService = 'Liquidity pool'.toUpperCase()
                  } else {
                    newService = service.toUpperCase()
                  }
                  const contractorType =
                    contractors[new Hash(contractor).md5]?.type.toUpperCase() ||
                    void 0

                  newArrayOfObject.push({
                    account: account.toUpperCase(),
                    contractor: contractor.toUpperCase(),
                    contractorType: contractorType,
                    service: newService,
                    project: project.toUpperCase(),
                    symbol: symbol.toUpperCase(),
                    symbolType: symbolType,
                    risk: risk,
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
    } catch (error) {
      new Log().addError('Balance.truncateInsertBalance', error)
    }
  }
}
