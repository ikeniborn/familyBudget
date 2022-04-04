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
      const services = new Portfolio().getWorkSheet('services').object
      const aggBalance = new Portfolio()
        .getWorkSheet('transactions')
        .arrayOfObject.filter((row) => !row.isDelete)
        .reduce((object, tx) => {
          let newService
          if (
            ['liquidity pool (1)', 'liquidity pool (2)']
              .map((m) => (m = new Hash(m).md5))
              .indexOf(new Hash(tx.service).md5) !== -1
          ) {
            newService = 'Liquidity pool'
          } else {
            newService = tx.service
          }
          if (!object[tx.account]) {
            object[tx.account] = {}
          }
          if (!object[tx.account][tx.contractor]) {
            object[tx.account][tx.contractor] = {}
          }
          if (!object[tx.account][tx.contractor][newService]) {
            object[tx.account][tx.contractor][newService] = {}
          }
          if (!object[tx.account][tx.contractor][newService][tx.project]) {
            object[tx.account][tx.contractor][newService][tx.project] = {}
          }
          if (
            !object[tx.account][tx.contractor][newService][tx.project][
              tx.symbol
            ]
          ) {
            object[tx.account][tx.contractor][newService][tx.project][
              tx.symbol
            ] = 0
          }
          object[tx.account][tx.contractor][newService][tx.project][
            tx.symbol
          ] += tx.quantity
          return object
        }, {})
      Object.entries(aggBalance).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          Object.entries(level1).forEach(([service, level2]) => {
            Object.entries(level2).forEach(([project, level3]) => {
              Object.entries(level3).forEach(([symbol, quantity]) => {
                const quantityRound = Math.round(quantity * 1000) / 1000
                if (quantityRound) {
                  const historicalPricesAvgKey = new Hash(
                    account + project + symbol
                  ).md5
                  const currentCost =
                    quantityRound * prices[new Hash(symbol).md5]?.price
                  const symbolType =
                    prices[new Hash(symbol).md5]?.symbolType.toUpperCase() ||
                    void 0
                  const historicalCostBuy =
                    historicalPricesAvg[historicalPricesAvgKey]?.quantityBuy *
                      historicalPricesAvg[historicalPricesAvgKey]?.priceBuy || 0
                  const historicalCostSell =
                    historicalPricesAvg[historicalPricesAvgKey]?.quantitySell *
                      historicalPricesAvg[historicalPricesAvgKey]?.priceSell ||
                    0
                  const historicalCostAvg =
                    quantityRound *
                      historicalPricesAvg[historicalPricesAvgKey]?.priceAvg || 0
                  const risk =
                    prices[new Hash(symbol).md5]?.risk.toUpperCase() || void 0
                  const contractorType =
                    contractors[new Hash(contractor).md5]?.type.toUpperCase() ||
                    void 0
                  const tokenStatus =
                    services[new Hash(service).md5].tokenStatus
                  newArrayOfObject.push({
                    account: account.toUpperCase(),
                    contractor: contractor.toUpperCase(),
                    contractorType: contractorType,
                    service: service.toUpperCase(),
                    project: project.toUpperCase(),
                    symbol: symbol.toUpperCase(),
                    symbolType: symbolType,
                    tokenStatus: tokenStatus.toUpperCase(),
                    risk: risk,
                    quantity: quantityRound,
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
