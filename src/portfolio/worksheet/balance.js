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
          let quantityBuy = 0
          let quantitySell = 0
          let quantityRefill = 0
          let quantityWriteOff = 0
          let quantityTransferIn = 0
          let quantityTransferOut = 0
          if (
            ['liquidity pool (1)', 'liquidity pool (2)']
              .map((m) => (m = new Hash(m).md5))
              .indexOf(new Hash(tx.service).md5) !== -1
          ) {
            newService = 'Liquidity pool'
          } else {
            newService = tx.service
          }
          //* Распределение количества по потокам

          new Hash(tx.operation).md5 === new Hash('buy').md5
            ? (quantityBuy += tx.quantity)
            : (quantityBuy += 0)

          new Hash(tx.operation).md5 === new Hash('sell').md5
            ? (quantitySell += tx.quantity)
            : (quantitySell += 0)

          new Hash(tx.operation).md5 === new Hash('refill').md5
            ? (quantityRefill += tx.quantity)
            : (quantityRefill += 0)

          new Hash(tx.operation).md5 === new Hash('write-off').md5
            ? (quantityWriteOff += tx.quantity * -1)
            : (quantityWriteOff += 0)

          new Hash(tx.operation + tx.direction).md5 ===
          new Hash('transfer' + 'in').md5
            ? (quantityTransferIn += tx.quantity)
            : (quantityTransferIn += 0)

          new Hash(tx.operation + tx.direction).md5 ===
          new Hash('transfer' + 'out').md5
            ? (quantityTransferOut += tx.quantity * -1)
            : (quantityTransferOut += 0)

          //* Агрегация
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
            ] = {
              quantityRest: 0,
              quantityBuy: 0,
              quantitySell: 0,
              quantityRefill: 0,
              quantityWriteOff: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
            }
          }

          object[tx.account][tx.contractor][newService][tx.project][
            tx.symbol
          ].quantityRest += tx.quantity

          object[tx.account][tx.contractor][newService][tx.project][
            tx.symbol
          ].quantityBuy += quantityBuy

          object[tx.account][tx.contractor][newService][tx.project][
            tx.symbol
          ].quantitySell += quantitySell

          object[tx.account][tx.contractor][newService][tx.project][
            tx.symbol
          ].quantityRefill += quantityRefill

          object[tx.account][tx.contractor][newService][tx.project][
            tx.symbol
          ].quantityWriteOff += quantityWriteOff

          object[tx.account][tx.contractor][newService][tx.project][
            tx.symbol
          ].quantityTransferIn += quantityTransferIn

          object[tx.account][tx.contractor][newService][tx.project][
            tx.symbol
          ].quantityTransferOut += quantityTransferOut

          return object
        }, {})

      Object.entries(aggBalance).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          Object.entries(level1).forEach(([service, level2]) => {
            Object.entries(level2).forEach(([project, level3]) => {
              Object.entries(level3).forEach(([symbol, quantity]) => {
                //* Распределение потоков
                const historicalPricesAvgKey = new Hash(
                  account + project + symbol
                ).md5
                const quantityInFlow =
                  quantity.quantityBuy +
                  quantity.quantityRefill +
                  quantity.quantityTransferIn

                const quantityOutFlow =
                  quantity.quantitySell +
                  quantity.quantityWriteOff +
                  quantity.quantityTransferOut
                const quantityFlow = quantityInFlow - quantityOutFlow
                const costInFlow =
                  historicalPricesAvg[historicalPricesAvgKey]?.costInFlow *
                    (quantityFlow /
                      historicalPricesAvg[historicalPricesAvgKey]
                        ?.quantityInFlow) || 0
                const costOutFlow =
                  historicalPricesAvg[historicalPricesAvgKey]?.costOutFlow *
                    (quantityFlow /
                      historicalPricesAvg[historicalPricesAvgKey]
                        ?.quantityInFlow) || 0
                //* дополнительная аналитика
                const symbolType =
                  prices[new Hash(symbol).md5]?.symbolType.toUpperCase() ||
                  void 0
                const risk =
                  prices[new Hash(symbol).md5]?.risk.toUpperCase() || void 0
                const contractorType =
                  contractors[new Hash(contractor).md5]?.type.toUpperCase() ||
                  void 0
                const tokenStatus = services[new Hash(service).md5].tokenStatus
                //* текущая стоимость
                const costRest =
                  quantity.quantityRest * prices[new Hash(symbol).md5]?.price
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
                  quantityRest: quantity.quantityRest,
                  quantityBuy: quantity.quantityBuy,
                  quantitySell: Math.abs(quantity.quantitySell),
                  quantityRefill: quantity.quantityRefill,
                  quantityWriteOff: Math.abs(quantity.quantityWriteOff),
                  quantityTransferIn: quantity.quantityTransferIn,
                  quantityTransferOut: Math.abs(quantity.quantityTransferOut),
                  quantityInFlow: quantityInFlow,
                  quantityOutFlow: Math.abs(quantityOutFlow),
                  costInFlow: costInFlow,
                  costOutFlow: Math.abs(costOutFlow),
                  costRest: costRest,
                })
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
