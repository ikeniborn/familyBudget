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
              quantityBuyIn: 0,
              quantityBuyOut: 0,
              quantitySellIn: 0,
              quantitySellOut: 0,
              quantityRefillIn: 0,
              quantityWriteOffOut: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
              quantityOverflowIn: 0,
              quantityOverflowOut: 0,
              quantityLock: 0,
              quantityUnlock: 0,
              quantityRest: 0,
              quantityRestInvest: 0,
              precision: 0,
              costBuyIn: 0,
              costBuyOut: 0,
              costSellIn: 0,
              costSellOut: 0,
              costRefillIn: 0,
              costWriteOffOut: 0,
              costTransferIn: 0,
              costTransferOut: 0,
              costOverflowIn: 0,
              costOverflowOut: 0,
              costRest: 0,
              costRestPrev: 0,
              costRestInvest: 0,
              costRestInvestPrev: 0,
              dayInPortfolioBuyInSum: 0,
              dayInPortfolioBuyOutSum: 0,
              dayInPortfolioSellOutSum: 0,
              dayInPortfolioSellInSum: 0,
              dayInPortfolioRefillInSum: 0,
              dayInPortfolioWriteOffOutSum: 0,
              dayInPortfolioTransferInSum: 0,
              dayInPortfolioTransferOutSum: 0,
              priceRest: 0,
              priceRestPrev: 0,
              priceRestInvest: 0,
              priceRestInvestPrev: 0,
              operationCount: 0,
              pnlRealized: 0,
              costRealized: 0
            }
          }
          //* Распределение количества по потокам

          if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
            if (directionKey === inKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowIn += tx.quantity
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOverflowIn += tx.cost
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityBuyIn += tx.quantity
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].dayInPortfolioBuyInSum += dayInPortfolio * tx.quantity
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costBuyIn += tx.cost
              }
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest += tx.quantity
              }
            } else if (directionKey === outKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowOut += tx.quantity * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOverflowOut += tx.cost * -1
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityBuyOut += tx.quantity * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].dayInPortfolioBuyOutSum += dayInPortfolio * tx.quantity * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costBuyOut += tx.cost * -1
              }
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest += tx.quantity
              }
            }
          }
          else if (
            operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
          ) {
            if (directionKey === inKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowIn += tx.quantity
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOverflowIn += tx.cost
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantitySellIn += tx.quantity
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].dayInPortfolioSellInSum += dayInPortfolio * tx.quantity
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costSellIn += tx.cost
              }
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest += tx.quantity
              }
            } else if (directionKey === outKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowOut += tx.quantity * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costOverflowOut += tx.cost * -1
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantitySellOut += tx.quantity * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].dayInPortfolioSellOutSum += dayInPortfolio * tx.quantity * -1
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costSellOut += tx.cost * -1
              }
              //* Накопление остатков
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest += tx.quantity
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest += tx.quantity
              }
            }
          }
          else if (
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
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest += tx.quantity
              }
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
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest += tx.quantity
              }
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
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest += tx.quantity
              }
            }
            else if (directionKey === outKey) {
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
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest += tx.quantity
              }
            }
          }

          //* Блокировки 
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

          //* Накопление остатков
          if (
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
              .operationCount === 0
          ) {
            //* остаток инвестиций
            if (tx.isOverflow === false && tx.isFee === false) {
              agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRestInvest =
                tx.cost

              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].costRestInvestPrev =
                agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRestInvest

              agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRestInvest =
                tx.cost / tx.quantity

              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].priceRestInvestPrev =
                agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRestInvest
            }
            //* остаток общий
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
            if (tx.isOverflow === false && tx.isFee === false) {
              //*остаток инвестиций
              if (
                agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                  .quantityRestInvest > 0
              ) {
                if (tx.quantity < 0) {
                  agg[tx.account][tx.portfolio][tx.contractor][
                    tx.symbol
                  ].costRestInvest =
                    tx.quantity *
                    agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                      .priceRestInvestPrev +
                    agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                      .costRestInvestPrev
                }
                else {
                  agg[tx.account][tx.portfolio][tx.contractor][
                    tx.symbol
                  ].costRestInvest =
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                      .costRestInvestPrev
                }

                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].priceRestInvest =
                  agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                    .costRestInvest /
                  agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                    .quantityRestInvest || 0

                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].priceRestInvestPrev =
                  agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
                    .priceRestInvest || 0

                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costRestPrevRestInvest =
                  agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRestInvest
              }
              else {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityRestInvest = 0
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].priceRestInvest = 0
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].priceRestPrevRestInvest = 0
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costRestPrevRestInvest = 0
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costRestInvest = 0
              }
            }
            //*остаток общий
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
            }
            else {
              agg[tx.account][tx.portfolio][tx.contractor][
                tx.symbol
              ].quantityRest = 0
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

          //* расчет реализованной прибыли
          if (
            operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
          ) {
            if (directionKey === outKey) {
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].pnlRealized +=
                  (tx.cost * -1) -
                  agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRest *
                  (tx.quantity * -1)
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].costRealized +=
                  (tx.cost * -1)
              }
            }
          }

          agg[tx.account][tx.portfolio][tx.contractor][
            tx.symbol
          ].operationCount += 1

          // if (
          //   new Hash(tx.account).md5 === new Hash('torrih').md5 &&
          //   new Hash(tx.symbol).md5 === new Hash('imx').md5
          // ) {
          //   console.log(
          //     'account:', tx.account, '\n'
          //     , 'operation:', tx.operation, '\n'
          //     , 'portfolio:', tx.portfolio, '\n'
          //     , 'contractor:', tx.contractor, '\n'
          //     , 'symbol:', tx.symbol, '\n'
          //     , 'direction:', tx.direction, '\n'
          //     , '#############SIGN###############', '\n'
          //     , 'isOverflow:', tx.isOverflow, '\n'
          //     , 'isFee:', tx.isFee, '\n'
          //     , '#############OPERATION###############', '\n'
          //     , 'operationCount:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].operationCount, '\n'
          //     , 'quantity:', tx.quantity, '\n'
          //     , 'cost:', tx.cost, '\n'
          //     , 'price:', tx.cost / tx.quantity, '\n'
          //     , '#############REST###############', '\n'
          //     , 'quantityRest:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityRest, '\n'
          //     , 'priceRest:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRest, '\n'
          //     , 'costRest:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRest, '\n'
          //     , 'priceRestPrev:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRestPrev, '\n'
          //     , 'costRestPrev:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRestPrev, '\n'
          //     , '#############INVEST###############', '\n'
          //     , 'quantityRestInvest:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityRestInvest, '\n'
          //     , 'priceRestInvest:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRestInvest, '\n'
          //     , 'costRestInvest:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRestInvest, '\n'
          //     , 'priceRestInvestPrev:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].priceRestInvestPrev, '\n'
          //     , 'costRestInvestPrev:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRestInvestPrev, '\n'
          //     , '#############PNL###############', '\n'
          //     , 'pnlRealized:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].pnlRealized, '\n'
          //     , 'costRealized:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].costRealized
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
              const useInReport = symbols[symbolKey]?.useInReport ? 1 : 0
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
              let quantityRest = 0
              // let quantityRestInvest = 0
              let quantityLock = 0

              if (object.quantityRest > 0) {
                quantityRest = Math.round(object.quantityRest * precisionCoeff) /
                  precisionCoeff
              }
              // if (object.quantityRestInvest > 0) {
              //   quantityRestInvest = Math.round(object.quantityRestInvest * precisionCoeff) /
              //     precisionCoeff
              // }
              quantityLock = Math.round(object.quantityLock * precisionCoeff) /
                precisionCoeff

              const priceLast = symbols[symbolKey]?.price || 0
              const costLast = Math.round(priceLast * quantityRest * 100) / 100 || 0
              const costLock = priceLast * quantityLock

              const costOverflow =
                Math.round(
                  (object.costOverflowIn - object.costOverflowOut) *
                  precisionCoeff
                ) / precisionCoeff

              const costRefillWriteOff =
                Math.round(
                  (object.costRefillIn -
                    object.costWriteOffOut
                  ) *
                  precisionCoeff
                ) / precisionCoeff

              let costRefillWriteOffInvest = 0

              if (costRefillWriteOff < 0) {
                costRefillWriteOffInvest += costRefillWriteOff * -1
              }

              const costBuy =
                Math.round(
                  (object.costBuyIn +
                    object.costSellIn
                  ) *
                  precisionCoeff
                ) / precisionCoeff

              const costSell =
                Math.round(
                  (object.costBuyOut +
                    object.costSellOut
                  ) *
                  precisionCoeff
                ) / precisionCoeff

              const costTransfer =
                Math.round(
                  (object.costTransferIn -
                    object.costTransferOut
                  ) *
                  precisionCoeff
                ) / precisionCoeff

              const costTotal =
                Math.round(
                  (costBuy +
                    costOverflow +
                    costTransfer +
                    costRefillWriteOffInvest
                  ) *
                  precisionCoeff
                ) / precisionCoeff

              const costInvest =
                Math.round(
                  (costTotal -
                    costSell +
                    object.costRestInvest
                  ) *
                  precisionCoeff
                ) / precisionCoeff

              //* количество 

              // const quantityBuy =
              //   object.quantityBuyIn +
              //   object.quantitySellIn

              // const quantitySell =
              //   object.quantityBuyOut +
              //   object.quantitySellOut

              const quantityOverflow =
                object.quantityOverflowIn -
                object.quantityOverflowOut

              // const quantityTransfer =
              //   object.quantityTransferIn -
              //   object.quantityTransferOut

              // const quantityRefillWriteOff =
              //   object.quantityRefillIn -
              //   object.quantityWriteOffOut

              // let quantityRefillWriteOffInvest = 0

              // if (quantityRefillWriteOff < 0) {
              //   quantityRefillWriteOffInvest += quantityRefillWriteOff * -1
              // }

              // const quantityTotal =
              //   quantityBuy +
              //   quantityOverflow +
              //   quantityTransfer +
              //   quantityRefillWriteOffInvest

              // const quantityInvest =
              //   quantityTotal -
              //   quantitySell +
              //   quantityRestInvest

              // //* расчет цены 

              // let priceInvest = 0
              // if (quantityInvest != 0) {
              //   priceInvest = costInvest / quantityInvest
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

              let quantityRebalance = 0
              if (priceLast !== 0 && object.priceRest !== 0) {
                const changePriceCoef = priceLast / object.priceRest
                let priceRebalance =
                  priceLast + (object.priceRest - priceLast) * changePriceCoef
                if (priceRebalance < 0) {
                  priceRebalance = 0
                }
                quantityRebalance =
                  (quantityRest * (object.priceRest - priceRebalance)) /
                  (priceRebalance - priceLast)
              }

              const pnlRealized =
                Math.round(
                  object.pnlRealized *
                  precisionCoeff
                ) / precisionCoeff

              const pnlUnrealized =
                Math.round(
                  (costLast - object.costRest) *
                  precisionCoeff
                ) / precisionCoeff

              const pnlTotal = pnlRealized + pnlUnrealized

              aggFlowArrayOfObject.push({
                account: account.toUpperCase(),
                portfolio: portfolio.toUpperCase(),
                contractor: contractor.toUpperCase(),
                contractorType: contractorType.toUpperCase(),
                contractorCategory: contractorCategory.toUpperCase(),
                symbol: symbol.toUpperCase(),
                symbolFullName: symbolFullName.toUpperCase(),
                symbolCategory: symbolCategory.toUpperCase(),
                // quantityInvest: quantityInvest || 0,
                // quantityBuy: quantityBuy || 0,
                // quantitySell: quantitySell || 0,
                // quantityTransfer: quantityTransfer || 0,
                quantityOverflow: quantityOverflow || 0,
                // quantitySell: quantitySell || 0,
                // quantityIn: quantityIn || 0,
                // quantityOut: quantityOut || 0,
                // quantityIn: quantityIn || 0,
                // quantityOut: quantityOut || 0,
                quantityRest: quantityRest || 0,
                quantityLock: quantityLock || 0,
                // quantityUnlock: quantityUnlock || 0,
                // priceIn: priceIn || 0,
                // priceOut: priceOut || 0,
                // priceInvest: priceInvest || 0,
                priceRest: object.priceRest || 0,
                priceLast: priceLast || 0,
                costTotal: costTotal || 0,
                // costSell: costSell || 0,
                // costBuyIn: object.costBuyIn || 0,
                // costBuyOut: object.costBuyOut || 0,
                // costRefillIn: object.costRefillIn || 0,
                // costSellIn: object.costSellIn || 0,
                // costSellOut: object.costSellOut || 0,
                // costWriteOffOut: object.costWriteOffOut || 0,
                // costTransferIn: object.costTransferIn || 0,
                // costTransferOut: object.costTransferOut || 0,
                // costTransfer: costTransfer || 0,
                // costOverflowIn: object.costOverflowIn || 0,
                // costOverflowOut: object.costOverflowOut || 0,
                costOverflow: costOverflow || 0,
                // costIn: costIn || 0,
                // costOut: costOut || 0,
                costInvest: costInvest || 0,
                costRest: object.costRest || 0,
                costLast: costLast || 0,
                costLock: costLock || 0,
                // costUnlock: costUnlock || 0,
                pnlRealized: pnlRealized || 0,
                pnlUnrealized: pnlUnrealized || 0,
                pnlTotal: pnlTotal || 0,
                quantityRebalance: quantityRebalance || 0,
                dayInPortfolioAvg,
                isSell: 0,
                useInReport: useInReport || false,
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
              quantityRest: 0,
              costRest: 0,
            }
          }
          symbolQuantityFlow[rowFlow.account][rowFlow.symbol].quantityRest +=
            rowFlow.quantityRest

          symbolQuantityFlow[rowFlow.account][rowFlow.symbol].costRest +=
            rowFlow.costRest
          return symbolQuantityFlow
        },
        {}
      )

      //* формирование признака продажи
      aggFlowArrayOfObject = aggFlowArrayOfObject.map((rowFlow) => {
        if (
          symbolsQuantityFlow[rowFlow.account][rowFlow.symbol].quantityRest <=
          0 ||
          Math.round(
            symbolsQuantityFlow[rowFlow.account][rowFlow.symbol].costRest
          ) <= 0
        ) {
          rowFlow.isSell = 1
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
              costLast: 0,
            }
          }
          agg[tx.account][tx.symbolCategory].costLast += tx.costLast
          return agg
        }, {})

      let aggFlowBalanceArrayOfObject = []
      Object.entries(aggFlowBalance).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([symbolCategory, object]) => {
          aggFlowBalanceArrayOfObject.push({
            account: account.toUpperCase(),
            symbolCategory: symbolCategory.toUpperCase(),
            costLast: object.costLast || 0,
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

