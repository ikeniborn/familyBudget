import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import { Prices } from './prices'
import { Transactions } from './transactions'
export { Flow }

class Flow {
  constructor(workSheet = '') {
    if (Flow.exists) {
      return Flow.instance
    }
    Flow.instance = this
    Flow.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Flow')
  }

  updateFlow() {
    try {
      const prices = new Prices().workSheet.object
      const contractors = new Portfolio().getWorkSheet('Contractors').object
      const inKey = new Hash('in').md5
      const outKey = new Hash('out').md5
      const aggFlow = new Transactions().workSheet.arrayOfObject
        .filter((row) => row.isDelete === false)
        .sort((a, b) => {
          return a.registryRowId - b.registryRowId
        })
        .reduce((agg, tx) => {
          const operationKey = new Hash(tx.operation).md5
          const directionKey = new Hash(tx.direction).md5
          const dayInPortfolio = new FormatDate().diffBetweenDate(tx.dateTime)
          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }
          if (!agg[tx.account][tx.contractor]) {
            agg[tx.account][tx.contractor] = {}
          }

          if (!agg[tx.account][tx.contractor][tx.symbol]) {
            agg[tx.account][tx.contractor][tx.symbol] = {
              quantityBuyIn: 0,
              quantityBuyOut: 0,
              quantitySellIn: 0,
              quantitySellOut: 0,
              quantityRefillIn: 0,
              quantityWriteOffOut: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
              quantityRest: 0,
              quantityRestLock: 0,
              quantityRestUnlock: 0,
              costBuyIn: 0,
              costBuyOut: 0,
              costSellIn: 0,
              costSellOut: 0,
              costRefillIn: 0,
              costWriteOffOut: 0,
              costTransferIn: 0,
              costTransferOut: 0,
              costBalance: 0,
              dayInPortfolioBuyInSum: 0,
              dayInPortfolioBuyOutSum: 0,
              dayInPortfolioSellOutSum: 0,
              dayInPortfolioSellInSum: 0,
              dayInPortfolioRefillInSum: 0,
              dayInPortfolioWriteOffOutSum: 0,
              dayInPortfolioTransferInSum: 0,
              dayInPortfolioTransferOutSum: 0,
            }
          }
          //* Распределение количества по потокам

          if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
            if (directionKey === inKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityBuyIn +=
                tx.quantity
              agg[tx.account][tx.contractor][tx.symbol].costBuyIn += tx.cost
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioBuyInSum += dayInPortfolio * tx.quantity
            } else if (directionKey === outKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityBuyOut +=
                tx.quantity * -1
              agg[tx.account][tx.contractor][tx.symbol].costBuyOut +=
                tx.cost * -1
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioBuyOutSum += dayInPortfolio * tx.quantity * -1
            }
          } else if (
            operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantitySellIn +=
                tx.quantity
              agg[tx.account][tx.contractor][tx.symbol].costSellIn += tx.cost
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioSellInSum += dayInPortfolio * tx.quantity
            } else if (directionKey === outKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantitySellOut +=
                tx.quantity * -1
              agg[tx.account][tx.contractor][tx.symbol].costSellOut +=
                tx.cost * -1
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioSellOutSum += dayInPortfolio * tx.quantity * -1
            }
          } else if (
            operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityRefillIn +=
                tx.quantity
              agg[tx.account][tx.contractor][tx.symbol].costRefillIn += tx.cost
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioRefillInSum += dayInPortfolio * tx.quantity
            }
          } else if (
            operationKey === '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
          ) {
            if (directionKey === outKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityWriteOffOut +=
                tx.quantity * -1
              agg[tx.account][tx.contractor][tx.symbol].costWriteOffOut +=
                tx.cost * -1
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioWriteOffOutSum +=
                dayInPortfolio * tx.quantity * -1
            }
          } else if (
            operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityTransferIn +=
                tx.quantity
              agg[tx.account][tx.contractor][tx.symbol].costTransferIn +=
                tx.cost
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioTransferInSum += dayInPortfolio * tx.quantity
            } else if (directionKey === outKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityTransferOut +=
                tx.quantity * -1
              agg[tx.account][tx.contractor][tx.symbol].costTransferOut +=
                tx.cost * -1
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioTransferOutSum +=
                dayInPortfolio * tx.quantity * -1
            }
          }

          if (tx.isLock) {
            agg[tx.account][tx.contractor][tx.symbol].quantityRestLock +=
              tx.quantity
          } else {
            agg[tx.account][tx.contractor][tx.symbol].quantityRestUnlock +=
              tx.quantity
          }

          agg[tx.account][tx.contractor][tx.symbol].quantityRest += tx.quantity

          if (agg[tx.account][tx.contractor][tx.symbol].quantityRest !== 0) {
            agg[tx.account][tx.contractor][tx.symbol].costBalance += tx.cost
          } else {
            agg[tx.account][tx.contractor][tx.symbol].costBalance = 0
          }
          // if (new Hash(tx.symbol).md5 === new Hash('gmt').md5) {
          //   console.log('registryRowId', tx.registryRowId)
          //   console.log(
          //     'quantityRest',
          //     agg[tx.account][tx.contractor][tx.symbol].quantityRest
          //   )
          //   console.log(
          //     'costBalance',
          //     agg[tx.account][tx.contractor][tx.symbol].costBalance
          //   )
          // }
          return agg
        }, {})
      const aggFlowArrayOfObject = []
      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          Object.entries(level1).forEach(([symbol, object]) => {
            //* доп. атрибуты
            //* атрибуты символа
            const symbolKey = new Hash(symbol).md5
            const symbolFullName = prices[symbolKey]?.name || ''
            const symbolCategory = prices[symbolKey]?.symbolCategory || ''
            const symbolEcosystem = prices[symbolKey]?.ecosystem || ''
            const symbolMarketCapGroup = prices[symbolKey]?.marketCapGroup || ''
            const symbolWeb3SpaceInterest =
              prices[symbolKey]?.web3SpaceInterest || ''
            //* атрибуты контрагента
            const contractorKey = new Hash(contractor).md5
            const contractorType = contractors[contractorKey]?.type || ''
            const contractorCategory =
              contractors[contractorKey]?.category || ''

            //* стоимость остатка
            const priceRest = prices[symbolKey]?.price || 0
            const costRest =
              Math.round(priceRest * object.quantityRest * 100) / 100
            const costRestLock = priceRest * object.quantityRestLock
            const costRestUnlock = priceRest * object.quantityRestUnlock

            //* расчет потоков
            const costInFlow =
              object.costBuyIn +
              object.costSellIn +
              object.costRefillIn +
              object.costTransferIn

            const costOwnInFlow =
              object.costBuyIn + object.costSellIn + object.costTransferIn

            const costOutFlow =
              object.costBuyOut +
              object.costSellOut +
              object.costWriteOffOut +
              object.costTransferOut

            const quantityInFlow =
              object.quantityBuyIn +
              object.quantitySellIn +
              object.quantityRefillIn +
              object.quantityTransferIn

            const quantityOwnInFlow =
              object.quantityBuyIn +
              object.quantitySellIn +
              object.quantityTransferIn

            const quantityOutFlow =
              object.quantityBuyOut +
              object.quantitySellOut +
              object.quantityWriteOffOut +
              object.quantityTransferOut

            //* расчет цены потоков

            const priceInFlow = costInFlow / quantityInFlow
            const priceOwnInFlow = costOwnInFlow / quantityOwnInFlow
            const priceOutFlow = costOutFlow / quantityOutFlow

            //* текущие остатки
            const costRestInFlow =
              object.costBalance < 0
                ? priceInFlow * object.quantityRest
                : object.costBalance
            const priceRestInFlow = costRestInFlow / object.quantityRest

            //* Расчет среднего времени в портфеле

            const dayInPortfolioAvg =
              object.dayInPortfolioBuyInSum / object.quantityBuyIn ||
              0 + object.dayInPortfolioSellInSum / object.quantitySellIn ||
              0 + object.dayInPortfolioRefillInSum / object.quantityRefillIn ||
              0 +
                object.dayInPortfolioTransferInSum /
                  object.quantityTransferIn ||
              -(
                object.dayInPortfolioBuyOutSum / object.quantityBuyOut ||
                0 + object.dayInPortfolioSellOutSum / object.quantitySellOut ||
                0 +
                  object.dayInPortfolioWriteOffOutSum /
                    object.quantityWriteOffOut ||
                0 +
                  object.dayInPortfolioTransferOutSum /
                    object.quantityTransferOut ||
                0
              )

            //* сумма окупаемости от вложения собсвенных средств

            const payback = costOutFlow - costOwnInFlow

            aggFlowArrayOfObject.push({
              account: account.toUpperCase(),
              contractor: contractor.toUpperCase(),
              contractorType: contractorType.toUpperCase(),
              contractorCategory: contractorCategory.toUpperCase(),
              symbol: symbol.toUpperCase(),
              symbolFullName: symbolFullName.toUpperCase(),
              symbolCategory: symbolCategory.toUpperCase(),
              symbolEcosystem: symbolEcosystem.toUpperCase(),
              symbolMarketCapGroup: symbolMarketCapGroup.toUpperCase(),
              symbolWeb3SpaceInterest: symbolWeb3SpaceInterest.toUpperCase(),
              quantityOwnInFlow: quantityOwnInFlow || 0,
              quantityInFlow: quantityInFlow || 0,
              quantityOutFlow: quantityOutFlow || 0,
              quantityRest: object.quantityRest || 0,
              quantityRestLock: object.quantityRestLock || 0,
              quantityRestUnlock: object.quantityRestUnlock || 0,
              priceOwnInFlow: priceOwnInFlow || 0,
              priceInFlow: priceInFlow || 0,
              priceOutFlow: priceOutFlow || 0,
              priceRestInFlow: priceRestInFlow || 0,
              priceRest: priceRest || 0,
              costOwnInFlow: costOwnInFlow || 0,
              costInFlow: costInFlow || 0,
              costOutFlow: costOutFlow || 0,
              costRest: costRest || 0,
              costRestInFlow: costRestInFlow || 0,
              costRestLock: costRestLock || 0,
              costRestUnlock: costRestUnlock || 0,
              pnlTotal: costOutFlow - costInFlow + costRest || 0,
              pnlRest: costRest - costRestInFlow || 0,
              payback: payback || 0,
              dayInPortfolioAvg,
            })
          })
        })
      })

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject)
    } catch (error) {
      console.error('FlowSymbol.updateFlow', error.stack)
    }
  }
}

//* Deprecated
//* FlowSymbol.updateFlow
// quantityBuyIn: object.quantityBuyIn || 0,
// quantityBuyOut: object.quantityBuyOut || 0,
// quantitySellIn: object.quantitySellIn || 0,
// quantitySellOut: object.quantitySellOut || 0,
// quantityRefillIn: object.quantityRefillIn || 0,
// quantityWriteOffOut: object.quantityWriteOffOut || 0,
// quantityTransferIn: object.quantityTransferIn || 0,
// quantityTransferOut: object.quantityTransferOut || 0,
// priceBuy: priceBuy || 0,
// priceSell: priceSell || 0,
// priceRefill: priceRefill || 0,
// priceWriteOff: priceWriteOff || 0,
// priceTransferIn: priceTransferIn || 0,
// priceTransferOut: priceTransferOut || 0,
// costBuyIn: object.costBuyIn || 0,
// costBuyOut: object.costBuyOut || 0,
// costSellIn: object.costSellIn || 0,
// costSellOut: object.costSellOut || 0,
// costRefillIn: object.costRefillIn || 0,
// costWriteOffOut: object.costWriteOffOut || 0,
// costTransferIn: object.costTransferIn || 0,
// costTransferOut: object.costTransferOut || 0,
