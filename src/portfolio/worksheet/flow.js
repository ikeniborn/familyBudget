import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import { Symbols } from './symbols'
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
      const symbols = new Symbols().workSheet.object
      const contractors = new Portfolio().getWorkSheet('Contractors').object
      const accounts = new Portfolio().getWorkSheet('Accounts').object
      const inKey = new Hash('in').md5
      const outKey = new Hash('out').md5
      const actualDate = new FormatDate()
      const updateDataMart = new FormatDate()

      const aggFlow = new Transactions().workSheet.arrayOfObject
        .filter((row) => row.isDelete === false)
        .sort((a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
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
              quantityFlow: 0,
              quantityLock: 0,
              quantityUnlock: 0,
              precision: 0,
              costBuyIn: 0,
              costBuyOut: 0,
              costSellIn: 0,
              costSellOut: 0,
              costRefillIn: 0,
              costWriteOffOut: 0,
              costTransferIn: 0,
              costTransferOut: 0,
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
            agg[tx.account][tx.contractor][tx.symbol].quantityLock +=
              tx.quantity
          } else {
            agg[tx.account][tx.contractor][tx.symbol].quantityUnlock +=
              tx.quantity
          }
          //* расчет точности
          const precisionArray = tx.quantity.toString().split('.')
          const precision = precisionArray[1]
            ? [...precisionArray[1].split('')].length
            : 0
          if (
            precision > agg[tx.account][tx.contractor][tx.symbol].precision &&
            precision <= 6
          ) {
            agg[tx.account][tx.contractor][tx.symbol].precision = precision
          } else if (
            precision > agg[tx.account][tx.contractor][tx.symbol].precision &&
            precision > 6
          ) {
            agg[tx.account][tx.contractor][tx.symbol].precision = 6
          }

          agg[tx.account][tx.contractor][tx.symbol].quantityFlow += tx.quantity

          return agg
        }, {})

      let aggFlowArrayOfObject = []
      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          Object.entries(level1).forEach(([symbol, object]) => {
            //* доп. атрибуты
            //* атрибуты символа
            const symbolKey = new Hash(symbol).md5
            const symbolFullName = symbols[symbolKey]?.name || ''
            const symbolCategory = symbols[symbolKey]?.symbolCategory || ''
            const symbolEcosystem = symbols[symbolKey]?.ecosystem || ''
            const symbolMarketCapGroup =
              symbols[symbolKey]?.marketCapGroup || ''
            const useInReport = symbols[symbolKey]?.useInReport
            const mainAccount = accounts[new Hash(account).md5].mainAccount
            //* атрибуты контрагента
            const contractorKey = new Hash(contractor).md5
            const contractorType = contractors[contractorKey]?.type || ''
            const contractorCategory =
              contractors[contractorKey]?.category || ''

            //* коэффициент точности по количеству
            let precisionCoeff = '1'
            for (let i = 0; i < object.precision; i++) {
              precisionCoeff += '0'
            }
            precisionCoeff = precisionCoeff * 1

            //* стоимость остатка
            const quantityFlow =
              Math.round(object.quantityFlow * precisionCoeff) / precisionCoeff
            const quantityLock =
              Math.round(object.quantityLock * precisionCoeff) / precisionCoeff
            const quantityUnlock =
              Math.round(object.quantityUnlock * precisionCoeff) /
              precisionCoeff
            const price = symbols[symbolKey]?.price || 0
            const cost = Math.round(price * quantityFlow * 100) / 100 || 0
            const costLock = price * quantityLock
            const costUnlock = price * quantityUnlock

            //* расчет потоков
            const costInFlow =
              Math.round(
                (object.costBuyIn +
                  object.costSellIn +
                  object.costRefillIn +
                  object.costTransferIn) *
                  precisionCoeff
              ) / precisionCoeff

            const costOwnInFlow =
              Math.round(
                (object.costBuyIn + object.costSellIn) * precisionCoeff
              ) / precisionCoeff

            const costOutFlow =
              Math.round(
                (object.costBuyOut +
                  object.costSellOut +
                  object.costWriteOffOut +
                  object.costTransferOut) *
                  precisionCoeff
              ) / precisionCoeff

            const quantityInFlow =
              Math.round(
                (object.quantityBuyIn +
                  object.quantitySellIn +
                  object.quantityRefillIn +
                  object.quantityTransferIn) *
                  precisionCoeff
              ) / precisionCoeff

            const quantityOwnInFlow =
              Math.round(
                (object.quantityBuyIn + object.quantitySellIn) * precisionCoeff
              ) / precisionCoeff

            const quantityOutFlow =
              Math.round(
                (object.quantityBuyOut +
                  object.quantitySellOut +
                  object.quantityWriteOffOut +
                  object.quantityTransferOut) *
                  precisionCoeff
              ) / precisionCoeff

            //* расчет цены потоков

            const priceInFlow = costInFlow / quantityInFlow || 0
            const priceOwnInFlow = costOwnInFlow / quantityOwnInFlow || 0
            const priceOutFlow = costOutFlow / quantityOutFlow || 0
            const priceFlowSum =
              priceInFlow * quantityInFlow + priceOutFlow * quantityOutFlow
            const quantityFlowSum = quantityInFlow + quantityOutFlow
            const priceFlow = priceFlowSum / quantityFlowSum || 0
            const costFlow =
              Math.round(priceFlow * quantityFlow * 100) / 100 || 0

            // if (
            //   new Hash(contractor).md5 === new Hash('TREZOR').md5 &&
            //   new Hash(symbol).md5 === new Hash('ETH').md5 &&
            //   new Hash(account).md5 === new Hash('IKENIBORN (LONG-TERM)').md5
            // ) {
            //   console.log(account, contractor, symbol)
            //   console.log('costInFlow', costInFlow)
            //   console.log('quantityInFlow', quantityInFlow)
            //   console.log('costOutFlow', costOutFlow)
            //   console.log('quantityOutFlow', quantityOutFlow)
            //   console.log('priceFlowSum', priceFlowSum)
            //   console.log('precisionCoeff', precisionCoeff)
            //   console.log('quantityFlow', quantityFlow)
            //   console.log('priceFlow', priceFlow)
            //   console.log('costFlow', costFlow)
            // }

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
            //* Количество на ребалансировки от изменения цены

            let quantityRebalance
            if (price) {
              const changePriceCoef = price / priceFlow
              const priceRebalance =
                price + (priceFlow - price) * changePriceCoef

              quantityRebalance =
                (quantityFlow * (priceFlow - priceRebalance)) /
                (priceRebalance - price)
            } else {
              quantityRebalance = 0
            }

            const payback = costOutFlow - costOwnInFlow

            aggFlowArrayOfObject.push({
              mainAccount: mainAccount.toUpperCase(),
              account: account.toUpperCase(),
              contractor: contractor.toUpperCase(),
              contractorType: contractorType.toUpperCase(),
              contractorCategory: contractorCategory.toUpperCase(),
              symbol: symbol.toUpperCase(),
              symbolFullName: symbolFullName.toUpperCase(),
              symbolCategory: symbolCategory.toUpperCase(),
              symbolEcosystem: symbolEcosystem.toUpperCase(),
              symbolMarketCapGroup: symbolMarketCapGroup.toUpperCase(),
              quantityOwnInFlow: quantityOwnInFlow || 0,
              quantityInFlow: quantityInFlow || 0,
              quantityOutFlow: quantityOutFlow || 0,
              quantityFlow: quantityFlow || 0,
              quantityLock: quantityLock || 0,
              quantityUnlock: quantityUnlock || 0,
              priceOwnInFlow: priceOwnInFlow || 0,
              priceInFlow: priceInFlow || 0,
              priceOutFlow: priceOutFlow || 0,
              priceFlow: priceFlow || 0,
              price: price || 0,
              costOwnInFlow: costOwnInFlow || 0,
              costInFlow: costInFlow || 0,
              costOutFlow: costOutFlow || 0,
              costFlow: costFlow || 0,
              cost: cost || 0,
              costLock: costLock || 0,
              costUnlock: costUnlock || 0,
              pnlFlow: cost - costFlow || 0,
              pnlTotal: costOutFlow - costInFlow + cost || 0,
              quantityRebalance: quantityRebalance || 0,
              payback: payback || 0,
              dayInPortfolioAvg,
              isSell: false,
              useInReport: useInReport,
              updateDataMart: updateDataMart.getFormatDate(
                'yyyy-MM-dd hh:mm:ss'
              ),
              actualDataMart:
                actualDate.yyyymmdd === updateDataMart.yyyymmdd ? true : false,
              updateDataMartKey: new Hash(updateDataMart.yyyymmdd).md5,
            })
          })
        })
      })

      //* агрегация количества по символу
      const symbolsQuantityFlow = aggFlowArrayOfObject.reduce(
        (symbolQuantityFlow, rowFlow) => {
          if (!symbolQuantityFlow[rowFlow.mainAccount]) {
            symbolQuantityFlow[rowFlow.mainAccount] = {}
          }
          if (!symbolQuantityFlow[rowFlow.mainAccount][rowFlow.symbol]) {
            symbolQuantityFlow[rowFlow.mainAccount][rowFlow.symbol] = {
              quantityFlow: 0,
              costFlow: 0,
            }
          }
          symbolQuantityFlow[rowFlow.mainAccount][
            rowFlow.symbol
          ].quantityFlow += rowFlow.quantityFlow

          symbolQuantityFlow[rowFlow.mainAccount][rowFlow.symbol].costFlow +=
            rowFlow.costFlow
          return symbolQuantityFlow
        },
        {}
      )

      //* формирование признака продажи
      aggFlowArrayOfObject = aggFlowArrayOfObject.map((rowFlow) => {
        if (
          symbolsQuantityFlow[rowFlow.mainAccount][rowFlow.symbol]
            .quantityFlow === 0 ||
          Math.round(
            symbolsQuantityFlow[rowFlow.mainAccount][rowFlow.symbol].costFlow
          ) === 0
        ) {
          rowFlow.isSell = true
        }

        return rowFlow
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
