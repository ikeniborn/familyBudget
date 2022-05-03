import { Portfolio } from '../portfolio/spreadsheet/portfolio'
import { Hash } from '../utils'
import { Prices } from '../portfolio/worksheet/prices'
import { Transactions } from '../portfolio/worksheet/transactions'
export { ContractorAllocation }

class ContractorAllocation {
  constructor(workSheet = void 0) {
    if (ContractorAllocation.exists) {
      return ContractorAllocation.instance
    }
    ContractorAllocation.instance = this
    ContractorAllocation.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('ContractorAllocation')
  }

  updateСontractorAllocation() {
    try {
      const prices = new Prices().workSheet.object
      const aggObject = new Transactions().workSheet.arrayOfObject
        .filter((row) => !row.isDelete)
        .reduce((agg, tx) => {
          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }
          if (!agg[tx.account][tx.contractor]) {
            agg[tx.account][tx.contractor] = {}
          }

          if (!agg[tx.account][tx.contractor][tx.symbol]) {
            agg[tx.account][tx.contractor][tx.symbol] = {
              quantityRest: 0,
            }
          }

          agg[tx.account][tx.contractor][tx.symbol].quantityRest += tx.quantity

          return agg
        }, {})
      const aggArrayOfObject = []

      Object.entries(aggObject).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          const contractorKey = new Hash(contractor).md5
          Object.entries(level1).forEach(([symbol, object]) => {
            const symbolKey = new Hash(symbol).md5
            const priceRest = prices[symbolKey]?.price || 0
            const costRest =
              Math.round(priceRest * object.quantityRest * 100) / 100
            if (costRest /*исключение нуkевого баланса по сумме*/) {
              aggArrayOfObject.push({
                account: account.toUpperCase(),
                constractor: contractor.toUpperCase(),
                contractorKey: contractorKey,
                symbol: symbol.toUpperCase(),
                symbolKey: symbolKey,
                quantityRest: object.quantityRest || 0,
                costRest: costRest || 0,
              })
            }
          })
        })
      })

      this.workSheet.truncateInsertRows(aggArrayOfObject)
    } catch (error) {
      console.error(
        'ContractorAllocation.updateСontractorAllocation',
        error.stack
      )
    }
  }
}
