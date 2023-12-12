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
      const inKey = new Hash('in').md5
      const outKey = new Hash('out').md5
      const updateDate = new FormatDate()
      const aggFlow = new Transactions().workSheet.arrayOfObject
        .filter((row) => row.isDelete === false)
        .sort((a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        })
        .reduce((agg, tx) => {
          const operationKey = new Hash(tx.operation).md5
          const directionKey = new Hash(tx.direction).md5

          const dayInPortfolio = new FormatDate(tx.dateTime).diffBetweenDate()
          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }

          if (!agg[tx.account][tx.portfolio]) {
            agg[tx.account][tx.portfolio] = {}
          }

          if (!agg[tx.account][tx.portfolio][tx.contractor]) {
            agg[tx.account][tx.portfolio][tx.contractor] = {}
          }

          if (!agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]) {
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol] = {
              quantityOwnBuyIn: 0,
              quantityBuyIn: 0,
              quantityOwnBuyOut: 0,
              quantityBuyOut: 0,
              quantityOwnSellIn: 0,
              quantitySellIn: 0,
              quantityOwnSellOut: 0,
              quantitySellOut: 0,
              quantityRefillIn: 0,
              quantityWriteOffOut: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
              quantityFlow: 0,
              quantityLock: 0,
              quantityUnlock: 0,
              precision: 0,
              costOwnBuyIn: 0,
              costBuyIn: 0,
              costOwnBuyOut: 0,
              costBuyOut: 0,
              costOwnSellIn: 0,
              costSellIn: 0,
              costOwnSellOut: 0,
              costSellOut: 0,
              costRefillIn: 0,
              costWriteOffOut: 0,
              costTransferIn: 0,
              costTransferOut: 0,
              costOverflowIn: 0,
              costOverflowOut: 0,
              dayInPortfolioOwnBuyInSum: 0,
              dayInPortfolioBuyInSum: 0,
              dayInPortfolioOwnBuyOutSum: 0,
              dayInPortfolioBuyOutSum: 0,
              dayInPortfolioOwnSellOutSum: 0,
              dayInPortfolioSellOutSum: 0,
              dayInPortfolioOwnSellInSum: 0,
              dayInPortfolioSellInSum: 0,
              dayInPortfolioRefillInSum: 0,
              dayInPortfolioWriteOffOutSum: 0,
              dayInPortfolioTransferInSum: 0,
              dayInPortfolioTransferOutSum: 0,
              quantityRest: 0,
              costRest: 0,
              priceRest: 0,
              quantityRestPrev: 0,
              costRestPrev: 0,
              priceRestPrev: 0,
              operationCount: 0,
            }
          }
          //* Распределение количества по потокам

          if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
            if (directionKey === inKey) {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityBuyIn += tx.quantity
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].dayInPortfolioBuyInSum += dayInPortfolio * tx.quantity
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOverflowIn += tx.cost
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costBuyIn += tx.cost
              }
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
              if (
                tx.isOverflow === false &&
                tx.isHistoricalAveragePrice === false &&
                tx.isAvgPrice === true &&
                tx.isFee === false
              ) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOwnBuyIn += tx.quantity
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOwnBuyIn += tx.cost
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].dayInPortfolioOwnBuyInSum += dayInPortfolio * tx.quantity
              }
            } else if (directionKey === outKey) {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityBuyOut += tx.quantity * -1
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].dayInPortfolioBuyOutSum += dayInPortfolio * tx.quantity * -1
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOverflowOut += tx.cost * -1
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costBuyOut += tx.cost * -1
              }
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
              if (
                tx.isOverflow === false &&
                tx.isHistoricalAveragePrice === false &&
                tx.isAvgPrice === true &&
                tx.isFee === false
              ) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOwnBuyOut += tx.quantity * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOwnBuyOut += tx.cost * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].dayInPortfolioOwnBuyOutSum +=
                  dayInPortfolio * tx.quantity * -1
              }
            }
          } else if (
            operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantitySellIn += tx.quantity
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].dayInPortfolioSellInSum += dayInPortfolio * tx.quantity
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOverflowIn += tx.cost
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costSellIn += tx.cost
              }
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
              if (
                tx.isOverflow === false &&
                tx.isHistoricalAveragePrice === false &&
                tx.isAvgPrice === true &&
                tx.isFee === false
              ) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOwnSellIn += tx.quantity
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOwnSellIn += tx.cost
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].dayInPortfolioOwnSellInSum += dayInPortfolio * tx.quantity
              }
            } else if (directionKey === outKey) {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantitySellOut += tx.quantity * -1

              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].dayInPortfolioSellOutSum += dayInPortfolio * tx.quantity * -1
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOverflowOut += tx.cost * -1
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costSellOut += tx.cost * -1
              }
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
              if (
                tx.isOverflow === false &&
                tx.isHistoricalAveragePrice === false &&
                tx.isAvgPrice === true &&
                tx.isFee === false
              ) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOwnSellOut += tx.quantity * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOwnSellOut += tx.cost * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].dayInPortfolioOwnSellOutSum +=
                  dayInPortfolio * tx.quantity * -1
              }
            }
          } else if (
            operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRefillIn += tx.quantity
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].costRefillIn += tx.cost
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].dayInPortfolioRefillInSum += dayInPortfolio * tx.quantity
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
            }
          } else if (
            operationKey === '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
          ) {
            if (directionKey === outKey) {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityWriteOffOut += tx.quantity * -1
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].costWriteOffOut += tx.cost * -1
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].dayInPortfolioWriteOffOutSum +=
                dayInPortfolio * tx.quantity * -1
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
            }
          } else if (
            operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityTransferIn += tx.quantity
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].costTransferIn += tx.cost
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].dayInPortfolioTransferInSum += dayInPortfolio * tx.quantity
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
            } else if (directionKey === outKey) {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityTransferOut += tx.quantity * -1
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].costTransferOut += tx.cost * -1
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].dayInPortfolioTransferOutSum +=
                dayInPortfolio * tx.quantity * -1
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
            }
          }

          if (tx.isLock) {
            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].quantityLock += tx.quantity
          } else {
            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].quantityUnlock += tx.quantity
          }
          //* расчет точности
          const precisionArray = tx.quantity.toString().split('.')
          const precision = precisionArray[1]
            ? [...precisionArray[1].split('')].length
            : 0
          if (
            precision >
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
              .precision &&
            precision <= 6
          ) {
            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].precision = precision
          } else if (
            precision >
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
              .precision &&
            precision > 6
          ) {
            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].precision = 6
          }

          agg[tx.account][tx.portfolio][tx.contractor][
            tx.symbol
          ].quantityFlow += tx.quantity

          //* Накопление остатков
          if (
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
              .operationCount === 0
          ) {
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRest =
              tx.cost

            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].costRestPrev =
              agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRest

            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRest =
              tx.cost / tx.quantity

            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].priceRestPrev =
              agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRest
          } else {
            if (
              agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                .quantityRest > 0
            ) {
              if (tx.quantity < 0) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costRest =
                  tx.quantity *
                  agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                    .priceRestPrev +
                  agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                    .costRestPrev
              } else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costRest =
                  tx.cost +
                  agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                    .costRestPrev
              }

              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].priceRest =
                agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                  .costRest /
                agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                  .quantityRest || 0

              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].priceRestPrev =
                agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                  .priceRest || 0

              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].costRestPrev =
                agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRest
            } else {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].priceRest = 0
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].priceRestPrev = 0
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].costRestPrev = 0
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].costRest = 0
            }
          }

          agg[tx.account][tx.portfolio][tx.contractor][
            tx.symbol
          ].operationCount += 1

          // if (
          //   new Hash(tx.account).md5 === new Hash('mskippy').md5 &&
          //   new Hash(tx.symbol).md5 === new Hash('op').md5
          // ) {
          //   console.log(
          //     tx.account,
          //     tx.portfolio,
          //     tx.contractor,
          //     tx.operation,
          //     tx.direction,
          //     tx.symbol
          //   )
          //   console.log(
          //     'operationCount',
          //     agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
          //       .operationCount
          //   )
          //   console.log('quantity', tx.quantity)
          //   console.log('cost', tx.cost)
          //   console.log('price', tx.cost / tx.quantity)
          //   console.log(
          //     'quantityRest',
          //     agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
          //       .quantityRest
          //   )
          //   console.log(
          //     'priceRest',
          //     agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRest
          //   )
          //   console.log(
          //     'costRest',
          //     agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRest
          //   )
          //   console.log(
          //     'priceRestPrev',
          //     agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
          //       .priceRestPrev
          //   )
          //   console.log(
          //     'costRestPrev',
          //     agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
          //       .costRestPrev
          //   )
          // }

          return agg
        }, {})

      let aggFlowArrayOfObject = []
      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([portfolio, level1]) => {
          Object.entries(level1).forEach(([contractor, level2]) => {
            Object.entries(level2).forEach(([symbol, object]) => {
              //* доп. атрибуты
              //* атрибуты символа
              const symbolKey = new Hash(symbol).md5
              const symbolFullName = symbols[symbolKey]?.name || ''
              const symbolCategory = symbols[symbolKey]?.symbolCategory || ''
              const useInReport = symbols[symbolKey]?.useInReport
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

              //* стоимость остатка исторического
              const quantityFlow =
                Math.round(object.quantityFlow * precisionCoeff) /
                precisionCoeff
              const quantityLock =
                Math.round(object.quantityLock * precisionCoeff) /
                precisionCoeff
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

              const costIn =
                Math.round(
                  (object.costBuyIn +
                    object.costSellIn +
                    object.costRefillIn) *
                  precisionCoeff
                ) / precisionCoeff

              const costOwnInFlow =
                Math.round(
                  (object.costOwnBuyIn + object.costOwnSellIn) * precisionCoeff
                ) / precisionCoeff

              const costOwnOutFlow =
                Math.round(
                  (object.costOwnBuyOut + object.costOwnSellOut) *
                  precisionCoeff
                ) / precisionCoeff

              const costOutFlow =
                Math.round(
                  (object.costBuyOut +
                    object.costSellOut +
                    object.costWriteOffOut +
                    object.costTransferOut) *
                  precisionCoeff
                ) / precisionCoeff

              const costOut =
                Math.round(
                  (object.costBuyOut +
                    object.costSellOut +
                    object.costWriteOffOut) *
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
                  (object.quantityOwnBuyIn + object.quantityOwnSellIn) *
                  precisionCoeff
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
                0 +
                object.dayInPortfolioRefillInSum / object.quantityRefillIn ||
                0 +
                object.dayInPortfolioTransferInSum /
                object.quantityTransferIn ||
                -(
                  object.dayInPortfolioBuyOutSum / object.quantityBuyOut ||
                  0 +
                  object.dayInPortfolioSellOutSum / object.quantitySellOut ||
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
                let priceRebalance =
                  price + (priceFlow - price) * changePriceCoef
                if (priceRebalance < 0) {
                  priceRebalance = 0
                }
                quantityRebalance =
                  (quantityFlow * (priceFlow - priceRebalance)) /
                  (priceRebalance - price)
              } else {
                quantityRebalance = 0
              }

              const payback = costOwnOutFlow - costOwnInFlow

              aggFlowArrayOfObject.push({
                account: account.toUpperCase(),
                portfolio: portfolio.toUpperCase(),
                contractor: contractor.toUpperCase(),
                contractorType: contractorType.toUpperCase(),
                contractorCategory: contractorCategory.toUpperCase(),
                symbol: symbol.toUpperCase(),
                symbolFullName: symbolFullName.toUpperCase(),
                symbolCategory: symbolCategory.toUpperCase(),
                quantityOwnInFlow: quantityOwnInFlow || 0,
                quantityInFlow: quantityInFlow || 0,
                quantityOutFlow: quantityOutFlow || 0,
                quantityFlow: quantityFlow || 0,
                quantityRest: object.quantityRest || 0,
                quantityLock: quantityLock || 0,
                quantityUnlock: quantityUnlock || 0,
                priceOwnInFlow: priceOwnInFlow || 0,
                priceInFlow: priceInFlow || 0,
                priceOutFlow: priceOutFlow || 0,
                priceFlow: priceFlow || 0,
                priceRest: object.priceRest || 0,
                price: price || 0,
                costOwnInFlow: costOwnInFlow || 0,
                costInFlow: costInFlow || 0,
                costOutFlow: costOutFlow || 0,
                costIn: costIn || 0,
                costOut: costOut || 0,
                costBuyIn: object.costBuyIn || 0,
                costBuyOut: object.costBuyOut || 0,
                costSellIn: object.costSellIn || 0,
                costSellOut: object.costSellOut || 0,
                costTransferIn: object.costTransferIn || 0,
                costTransferOut: object.costTransferOut || 0,
                costOverflowIn: object.costOverflowIn || 0,
                costOverflowOut: object.costOverflowOut || 0,
                costRefillIn: object.costRefillIn || 0,
                costWriteOffOut: object.costWriteOffOut || 0,
                costFlow: costFlow || 0,
                costRest: object.costRest || 0,
                cost: cost || 0,
                costLock: costLock || 0,
                costUnlock: costUnlock || 0,
                pnlFlow: cost - costFlow || 0,
                pnlRest: cost - object.costRest || 0,
                pnlTotal: costOutFlow + cost - costInFlow || 0,
                quantityRebalance: quantityRebalance || 0,
                payback: payback || 0,
                dayInPortfolioAvg,
                isSell: false,
                useInReport: useInReport,
                updateDate: updateDate.getFormatDate('yyyy-MM-dd HH:mm'),
              })
            })
          })
        })
      })

      //* агрегация количества по символу
      const symbolsQuantityFlow = aggFlowArrayOfObject.reduce(
        (symbolQuantityFlow, rowFlow) => {
          if (!symbolQuantityFlow[rowFlow.account]) {
            symbolQuantityFlow[rowFlow.account] = {}
          }
          if (!symbolQuantityFlow[rowFlow.account][rowFlow.symbol]) {
            symbolQuantityFlow[rowFlow.account][rowFlow.symbol] = {
              quantityFlow: 0,
              costFlow: 0,
            }
          }
          symbolQuantityFlow[rowFlow.account][rowFlow.symbol].quantityFlow +=
            rowFlow.quantityFlow

          symbolQuantityFlow[rowFlow.account][rowFlow.symbol].costFlow +=
            rowFlow.costFlow
          return symbolQuantityFlow
        },
        {}
      )

      //* формирование признака продажи
      aggFlowArrayOfObject = aggFlowArrayOfObject.map((rowFlow) => {
        if (
          symbolsQuantityFlow[rowFlow.account][rowFlow.symbol].quantityFlow ===
          0 ||
          Math.round(
            symbolsQuantityFlow[rowFlow.account][rowFlow.symbol].costFlow
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

  updateFlowBalance() {
    try {
      const actualDate = new FormatDate().getDateBegin()
      const updateDataMart = new FormatDate().getDateBegin()
      const updateDate = new FormatDate()
      const flowBalance = new Portfolio().getWorkSheet('FlowBalance')
      const flowBalanceHistory = flowBalance.arrayOfObject.filter(
        (rowObject) => {
          return rowObject.updateDataMartKey !== actualDate.dateKey
        }
      )

      const aggFlowBalance = this.workSheet.arrayOfObject
        .filter((rowObject) => {
          return rowObject.useInReport == true
        })
        .reduce((agg, tx) => {
          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }

          if (!agg[tx.account][tx.symbolCategory]) {
            agg[tx.account][tx.symbolCategory] = {
              cost: 0,
            }
          }
          agg[tx.account][tx.symbolCategory].cost += tx.cost
          return agg
        }, {})

      let aggFlowBalanceArrayOfObject = []
      Object.entries(aggFlowBalance).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([symbolCategory, object]) => {
          aggFlowBalanceArrayOfObject.push({
            account: account.toUpperCase(),
            symbolCategory: symbolCategory.toUpperCase(),
            cost: object.cost || 0,
            updateDataMart: updateDataMart.getFormatDate('yyyy-MM-dd'),
            updateDate: updateDate.getFormatDate('yyyy-MM-dd HH:mm'),
            updateDataMartKey: updateDataMart.dateKey,
          })
        })
      })
      flowBalance.truncateInsertRows([
        ...flowBalanceHistory,
        ...aggFlowBalanceArrayOfObject,
      ])
    } catch (error) {
      console.error('FlowSymbol.updateFlowBalance', error.stack)
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
