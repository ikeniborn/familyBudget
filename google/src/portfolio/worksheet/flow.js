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
      const transactions = new Transactions().workSheet.arrayOfObject
        .filter((row) => row.isDelete === false)
        .sort((a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        })

      //* расчет по портфолио  
      const aggFlowPortfolio = transactions
        .filter((row) => ['84a0f3455dcca894ace136be62efa292' /*transfer*/].indexOf(new Hash(row.operation).md5) === -1)
        .reduce((agg, tx) => {
          const operationKey = new Hash(tx.operation).md5
          const directionKey = new Hash(tx.direction).md5
          const symbolKey = new Hash(tx.symbol).md5
          const symbolCategory = symbols[symbolKey]?.symbolCategory || ''

          if (!agg[tx.account]) {
            agg[tx.account] = {}
          }

          if (!agg[tx.account][tx.portfolio]) {
            agg[tx.account][tx.portfolio] = {}
          }

          if (!agg[tx.account][tx.portfolio][tx.symbol]) {
            agg[tx.account][tx.portfolio][tx.symbol] = {
              quantityRest: 0,
              costRest: 0,
              costRestPrev: 0,
              priceRest: 0,
              priceRestPrev: 0,
              quantityRestOverflow: 0,
              costRestOverflow: 0,
              costRestPrevOverflow: 0,
              priceRestOverflow: 0,
              priceRestPrevOverflow: 0,
              quantityRestWoOverflow: 0,
              costRestWoOverflow: 0,
              costRestPrevWoOverflow: 0,
              priceRestWoOverflow: 0,
              priceRestPrevWoOverflow: 0,
              quantityRestInvest: 0,
              costRestInvest: 0,
              costTotal: 0,
              costRestInvestPrev: 0,
              priceRestInvest: 0,
              priceRestInvestPrev: 0,
              operationCount: 0,
              pnlRealized: 0,
              costRealized: 0
            }
          }

          //* Накопление остатков
          agg[tx.account][tx.portfolio][tx.symbol].quantityRest += tx.quantity

          //* остаток по переливу
          if (tx.isOverflow === true) {
            agg[tx.account][tx.portfolio][tx.symbol].quantityRestOverflow +=
              tx.quantity

          }
          //* остаток без перелива
          if (tx.isOverflow === false) {
            agg[tx.account][tx.portfolio][tx.symbol].quantityRestWoOverflow +=
              tx.quantity
          }

          //* Накопление количества инвестированношгоe
          if (
            tx.isOverflow === false
            &&
            tx.isFee === false
            &&
            (
              [
                'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
                , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
              ].indexOf(operationKey) === -1
              ||
              [
                '7d5f30a0d1641c0b6980aaf2556b32ce' /* Fiat */
              ].indexOf(
                new Hash(symbolCategory).md5
              ) !== -1
            )
          ) {
            agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest += tx.quantity
          }

          //* Накопление остатков для портфолио
          if (
            agg[tx.account][tx.portfolio][tx.symbol]
              .operationCount === 0
          )
          //* первая операция 
          {
            if (
              tx.isOverflow === false
              &&
              tx.isFee === false
              &&
              (
                [
                  'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
                  , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
                ].indexOf(operationKey) === -1
                ||
                [
                  '7d5f30a0d1641c0b6980aaf2556b32ce' /* Fiat */
                ].indexOf(
                  new Hash(symbolCategory).md5
                ) !== -1
              )
            ) {
              agg[tx.account][tx.portfolio][tx.symbol].costRestInvest =
                tx.cost
              agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev =
                agg[tx.account][tx.portfolio][tx.symbol].costRestInvest
              agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest =
                tx.cost / tx.quantity
              agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev =
                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest
            }

            //* общий остаток
            agg[tx.account][tx.portfolio][tx.symbol].costRest =
              tx.cost
            agg[tx.account][tx.portfolio][tx.symbol].costRestPrev =
              agg[tx.account][tx.portfolio][tx.symbol].costRest
            agg[tx.account][tx.portfolio][tx.symbol].priceRest =
              tx.cost / tx.quantity
            agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev =
              agg[tx.account][tx.portfolio][tx.symbol].priceRest

            //* остаток по переливу
            if (tx.isOverflow === true) {
              agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow =
                tx.cost
              agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow =
                agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow
              agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow =
                tx.cost / tx.quantity
              agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevOverflow =
                agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow
            }

            //* остаток без перелива
            if (tx.isOverflow === false) {
              agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow =
                tx.cost
              agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow =
                agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow
              agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow =
                tx.cost / tx.quantity
              agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevWoOverflow =
                agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow
            }

          }
          //* не первая операция
          else {
            //*остаток инвестиций
            if (
              tx.isOverflow === false
              &&
              tx.isFee === false
              &&
              (
                [
                  'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
                  , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
                ].indexOf(operationKey) === -1
                ||
                [
                  '7d5f30a0d1641c0b6980aaf2556b32ce' /* Fiat */
                ].indexOf(
                  new Hash(symbolCategory).md5
                ) !== -1
              )
            ) {
              if (
                agg[tx.account][tx.portfolio][tx.symbol]
                  .quantityRestInvest > 0
              )
              //* обновление информации по инвестированному
              {
                //* уменьшение остатка
                if (tx.quantity < 0) {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestInvest =
                    // tx.quantity *
                    // agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev +
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev
                }
                //* увеличение остатка
                else {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestInvest =
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev
                }

                //* расчет обновленной цены
                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestInvest /
                  agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest || 0

                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev =
                  agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest || 0

                agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestInvest
              }
              //* обнуление инвестирования
              else {
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest = 0
                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest = 0
                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev = 0
                agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev = 0
                agg[tx.account][tx.portfolio][tx.symbol].costRestInvest = 0
              }
            }

            //*остаток общий
            if (
              agg[tx.account][tx.portfolio][tx.symbol].quantityRest > 0
            ) {
              if (tx.quantity < 0) {
                agg[tx.account][tx.portfolio][tx.symbol].costRest =
                  tx.quantity *
                  agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev +
                  agg[tx.account][tx.portfolio][tx.symbol].costRestPrev
              }
              else {
                agg[tx.account][tx.portfolio][tx.symbol].costRest =
                  tx.cost +
                  agg[tx.account][tx.portfolio][tx.symbol].costRestPrev
              }

              agg[tx.account][tx.portfolio][tx.symbol].priceRest =
                agg[tx.account][tx.portfolio][tx.symbol].costRest /
                agg[tx.account][tx.portfolio][tx.symbol].quantityRest || 0

              agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev =
                agg[tx.account][tx.portfolio][tx.symbol].priceRest || 0

              agg[tx.account][tx.portfolio][tx.symbol].costRestPrev =
                agg[tx.account][tx.portfolio][tx.symbol].costRest
            }
            else {
              agg[tx.account][tx.portfolio][tx.symbol].quantityRest = 0
              agg[tx.account][tx.portfolio][tx.symbol].priceRest = 0
              agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev = 0
              agg[tx.account][tx.portfolio][tx.symbol].costRestPrev = 0
              agg[tx.account][tx.portfolio][tx.symbol].costRest = 0
            }

            //* остаток перелива 
            if (tx.isOverflow === true) {
              if (
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestOverflow > 0
              ) {
                if (tx.quantity < 0) {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow =
                    tx.quantity *
                    agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevOverflow +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow
                }
                else {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow =
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow
                }

                agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow /
                  agg[tx.account][tx.portfolio][tx.symbol].quantityRestOverflow || 0

                agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow || 0

                agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow
              }
              else {
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestOverflow = 0
                agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow = 0
                agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevOverflow = 0
                agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow = 0
                agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow = 0
              }
            }

            //* остаток без перелива
            if (tx.isOverflow === false) {
              if (
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestWoOverflow > 0
              ) {
                if (tx.quantity < 0) {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow =
                    tx.quantity *
                    agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevWoOverflow +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow
                }
                else {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow =
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow
                }

                agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow /
                  agg[tx.account][tx.portfolio][tx.symbol].quantityRestWoOverflow || 0

                agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevWoOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow || 0

                agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow
              }
              else {
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestWoOverflow = 0
                agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow = 0
                agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevWoOverflow = 0
                agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow = 0
                agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow = 0
              }
            }

          }

          //* расчет реализованной прибыли
          if (
            operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
          ) {
            if (directionKey === outKey) {
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].pnlRealized +=
                  (tx.cost * -1) -
                  agg[tx.account][tx.portfolio][tx.symbol].priceRest *
                  (tx.quantity * -1)

                agg[tx.account][tx.portfolio][tx.symbol].costRealized +=
                  (tx.cost * -1)

                // agg[tx.account][tx.portfolio][tx.symbol].costRestInvest -=
                // agg[tx.account][tx.portfolio][tx.symbol].costRealized
                // agg[tx.account][tx.portfolio][tx.symbol].pnlRealized
              }
              if (tx.isOverflow === true && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].costTotal +=
                  (tx.cost * 1)
              }
            }
            if (directionKey === inKey) {
              if (tx.isOverflow === true && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].costTotal +=
                  (tx.cost * -1)
              }
            }
          }

          //* расчет итоговой стоимости
          if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
            if (directionKey === inKey) {
              if (tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].costTotal +=
                  (tx.cost * 1)
              }
            }
            if (directionKey === outKey) {
              if (tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].costTotal +=
                  (tx.cost * 1)
              }
            }
          }

          //* Обнуление инвестиций сумме
          if (agg[tx.account][tx.portfolio][tx.symbol].costRestInvest < 0) {
            agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest = 0
            agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest = 0
            agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev = 0
            agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev = 0
            agg[tx.account][tx.portfolio][tx.symbol].costRestInvest = 0
          }

          agg[tx.account][tx.portfolio][tx.symbol].operationCount += 1

          // if (
          //   new Hash(tx.account).md5 === new Hash('ikeniborn').md5 &&
          //   new Hash(tx.symbol).md5 === new Hash('link').md5 &&
          //   new Hash(tx.portfolio).md5 === new Hash('main').md5
          // ) {
          //   console.log(
          //     'account:', tx.account, '\n'
          //     , 'dateTime', new FormatDate(tx.dateTime).getFormatDate('yyyy-MM-dd HH:mm'), '\n'
          //     , 'operation:', tx.operation, '\n'
          //     , 'portfolio:', tx.portfolio, '\n'
          //     , 'contractor:', tx.contractor, '\n'
          //     , 'symbol:', tx.symbol, '\n'
          //     , 'direction:', tx.direction, '\n'
          //     , '#############SIGN###############', '\n'
          //     , 'isOverflow:', tx.isOverflow, '\n'
          //     , 'isFee:', tx.isFee, '\n'
          //     , '#############OPERATION###############', '\n'
          //     , 'operationCount:', agg[tx.account][tx.portfolio][tx.symbol].operationCount, '\n'
          //     , 'quantity:', tx.quantity, '\n'
          //     , 'cost:', tx.cost, '\n'
          //     , 'price:', tx.cost / tx.quantity, '\n'
          //     , '#############RESTPORTFOLIO###############', '\n'
          //     , 'quantityRest:', agg[tx.account][tx.portfolio][tx.symbol].quantityRest, '\n'
          //     , 'priceRest:', agg[tx.account][tx.portfolio][tx.symbol].priceRest, '\n'
          //     , 'costRest:', agg[tx.account][tx.portfolio][tx.symbol].costRest, '\n'
          //     , 'priceRestPrev:', agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev, '\n'
          //     , 'costRestPrev:', agg[tx.account][tx.portfolio][tx.symbol].costRestPrev, '\n'
          //     , '#############INVESTPORTFOLIO###############', '\n'
          //     , 'quantityRestInvest:', agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest, '\n'
          //     , 'priceRestInvest:', agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest, '\n'
          //     , 'costRestInvest:', agg[tx.account][tx.portfolio][tx.symbol].costRestInvest, '\n'
          //     , 'priceRestInvestPrev:', agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev, '\n'
          //     , 'costRestInvestPrev:', agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev, '\n'
          //     , '#############PNL###############', '\n'
          //     , 'costTotal:', agg[tx.account][tx.portfolio][tx.symbol].costTotal, '\n'
          //     , 'pnlRealized:', agg[tx.account][tx.portfolio][tx.symbol].pnlRealized, '\n'
          //     , 'costRealized:', agg[tx.account][tx.portfolio][tx.symbol].costRealized, '\n'
          //   )
          // }

          return agg
        }, {})

      //* расчет по контрагенту  
      const aggFlowContractor = transactions
        .reduce((agg, tx) => {
          const operationKey = new Hash(tx.operation).md5
          const directionKey = new Hash(tx.direction).md5

          // const dayInPortfolio = new FormatDate(tx.dateTime).diffBetweenDate()
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
              quantityOverflowIn: 0,
              quantityOverflowOut: 0,
              quantityLock: 0,
              quantityRest: 0,
              precision: 0,
              operationCount: 0,
            }
          }

          //* Распределение количества по потокам

          if (operationKey === '0bd9f6dd716003f3818d15d2e211ee73' /*Overflow*/) {
            if (directionKey === inKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowIn += tx.quantity
              }
            } else if (directionKey === outKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowOut += tx.quantity * -1
              }
            }
          }
          else if (
            operationKey === '63275978133392f666f8fcc20f502304' /*Backflow*/
          ) {
            if (directionKey === inKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowIn += tx.quantity
              }
            } else if (directionKey === outKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowOut += tx.quantity * -1
              }
            }
          }

          //* Накопление остатков
          agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityRest += tx.quantity

          //* Блокировки 
          if (tx.isLock) {
            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].quantityLock += tx.quantity
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

          // if (
          //   agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
          //     .quantityRest < 0
          // ) {
          //   agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
          //     .quantityRest = 0
          // }

          agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].operationCount += 1

          // if (
          //   new Hash(account).md5 === new Hash('ikeniborn').md5 &&
          //   new Hash(symbol).md5 === new Hash('link').md5 &&
          //   new Hash(tx.portfolio).md5 === new Hash('main').md5 &&
          //   new Hash(tx.contractor).md5 === new Hash('safepal').md5
          // ) {
          //   console.log(
          //     'account:', tx.account, '\n'
          //     , 'dateTime', new FormatDate(tx.dateTime).getFormatDate('yyyy-MM-dd HH:mm'), '\n'
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
          //     , '#############RESTContractor###############', '\n'
          //     , 'quantityRest:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityRest, '\n'
          //     , 'quantityOverflowIn:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityOverflowIn, '\n'
          //     , 'quantityOverflowOut:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityOverflowOut, '\n'
          //   )
          // }


          return agg
        }, {})

      let aggFlowArrayOfObject = []
      Object.entries(aggFlowContractor).forEach(([account, level0]) => {
        const portfolioCount = Object.keys(aggFlowPortfolio[account]).length
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
              const contractorCategory = contractors[contractorKey]?.category || ''


              //* коэффициент точности по количеству
              let precisionCoeff = '1'
              for (let i = 0; i < object.precision; i++) {
                precisionCoeff += '0'
              }
              precisionCoeff = precisionCoeff * 1

              //* стоимость остатка исторического
              let quantityRest = 0
              let quantityLock = 0

              quantityRest = Math.round(object.quantityRest * precisionCoeff) / precisionCoeff

              if (object.quantityLock > 0) {
                quantityLock = Math.round(object.quantityLock * precisionCoeff) /
                  precisionCoeff
              }

              let priceLast = 0
              let priceRestOverflow = 0
              let priceRestWoOverflow = 0
              let priceRest = 0
              let costLast = 0
              let costLock = 0
              let costTotal = 0
              let costInvest = 0
              let costRest = 0
              let costRealized = 0
              let pnlRealized = 0
              let pnlUnrealized = 0
              let pnlTotal = 0
              let quantityOverflow = 0
              let quantityRebalance = 0
              let quantityInvest = 0


              priceLast = symbols[symbolKey]?.price || 0
              costLast = Math.round(priceLast * quantityRest * 100) / 100 || 0
              costLock = priceLast * quantityLock

              if (aggFlowPortfolio[account][portfolio][symbol]) {

                priceRest = aggFlowPortfolio[account][portfolio][symbol].priceRest
                priceRestOverflow = aggFlowPortfolio[account][portfolio][symbol].priceRestOverflow
                priceRestWoOverflow = aggFlowPortfolio[account][portfolio][symbol].priceRestWoOverflow

                let allocationCoefficient = 0

                if (aggFlowPortfolio[account][portfolio][symbol].quantityRest > 0) {
                  allocationCoefficient = quantityRest / aggFlowPortfolio[account][portfolio][symbol].quantityRest
                } else {
                  allocationCoefficient = 1 / portfolioCount
                }

                //* стоимость инвестиций
                costInvest = Math.round(
                  (aggFlowPortfolio[account][portfolio][symbol].costRestInvest * allocationCoefficient)
                ) || 0

                //* стоимость остатка
                costRest =
                  Math.round(
                    (aggFlowPortfolio[account][portfolio][symbol].costRest * allocationCoefficient)
                  ) || 0

                //* общая стоимость
                costTotal = Math.round(
                  (
                    aggFlowPortfolio[account][portfolio][symbol].costTotal
                    * allocationCoefficient
                  )
                ) || 0

                //* реализованная прибыль
                costRealized =
                  Math.round(
                    (aggFlowPortfolio[account][portfolio][symbol].costRealized * allocationCoefficient)
                  ) || 0

                //* реализованная прибыль
                pnlRealized =
                  Math.round(
                    (aggFlowPortfolio[account][portfolio][symbol].pnlRealized * allocationCoefficient)
                  ) || 0

                //* не реализованная прибыль
                pnlUnrealized =
                  Math.round((costLast - costRest)) || 0

                //* прибыль итоговая
                pnlTotal = pnlRealized + pnlUnrealized


                //* Количество на ребалансировки от изменения цены

                if (priceLast !== 0 && priceRest !== 0) {
                  const changePriceCoef = priceLast / priceRest
                  let priceRebalance =
                    priceLast + (priceRest - priceLast) * changePriceCoef
                  if (priceRebalance < 0) {
                    priceRebalance = 0
                  }
                  quantityRebalance =
                    (quantityRest * (priceRest - priceRebalance)) /
                    (priceRebalance - priceLast)
                }

                //* количество перелива
                quantityOverflow =
                  object.quantityOverflowIn -
                  object.quantityOverflowOut

                //* количество инвестированного по текущей цене

                quantityInvest = costInvest / priceLast

                // if (
                //   new Hash(account).md5 === new Hash('ikeniborn').md5 &&
                //   new Hash(symbol).md5 === new Hash('link').md5 &&
                //   new Hash(portfolio).md5 === new Hash('main').md5
                // ) {
                //   console.log(
                //     'account:', account, '\n'
                //     , 'portfolio:', portfolio, '\n'
                //     , 'contractor:', contractor, '\n'
                //     , 'symbol:', symbol, '\n'
                //     , '###aggFlowPortfolio###', '\n'
                //     , 'quantityRestInvest:', aggFlowPortfolio[account][portfolio][symbol].quantityRestInvest, '\n'
                //     , 'costRestInvest:', aggFlowPortfolio[account][portfolio][symbol].costRestInvest, '\n'
                //     , 'quantityRest:', aggFlowPortfolio[account][portfolio][symbol].quantityRest, '\n'
                //     , 'priceRest:', aggFlowPortfolio[account][portfolio][symbol].priceRest, '\n'
                //     , 'costTotal:', aggFlowPortfolio[account][portfolio][symbol].costTotal, '\n'
                //     , '###aggFlowContractor###', '\n'
                //     , 'allocationCoefficient:', allocationCoefficient, '\n'
                //     , 'quantityRest:', quantityRest, '\n'
                //     , 'quantityInvest:', quantityInvest, '\n'
                //     , 'quantityOverflow:', quantityOverflow, '\n'
                //     , 'costInvest:', costInvest, '\n'
                //     , 'costRest:', costRest, '\n'
                //     , 'costTotal:', costTotal, '\n'
                //     , 'pnlRealized:', pnlRealized, '\n'
                //     , 'pnlUnrealized:', pnlUnrealized, '\n'
                //     , 'pnlTotal:', pnlTotal, '\n'
                //   )
                // }
              }



              //* Расчет среднего времени в портфеле

              // const dayInPortfolioAvg =
              //   object.dayInPortfolioBuyInSum / object.quantityBuyIn ||
              //   0 + object.dayInPortfolioSellInSum / object.quantitySellIn ||
              //   0 +
              //   object.dayInPortfolioRefillInSum / object.quantityRefillIn ||
              //   0 +
              //   object.dayInPortfolioTransferInSum /
              //   object.quantityTransferIn ||
              //   -(
              //     object.dayInPortfolioBuyOutSum / object.quantityBuyOut ||
              //     0 +
              //     object.dayInPortfolioSellOutSum / object.quantitySellOut ||
              //     0 +
              //     object.dayInPortfolioWriteOffOutSum /
              //     object.quantityWriteOffOut ||
              //     0 +
              //     object.dayInPortfolioTransferOutSum /
              //     object.quantityTransferOut ||
              //     0
              //   )


              let symbolType = 'na'

              if (
                [
                  'e5e3fd01394b9a81296b75d5a7f4c1a2' /* Stablecoin */
                ].indexOf(
                  new Hash(symbolCategory).md5
                ) !== -1
              ) {
                symbolType = 'STABLECOIN'
              }
              else if (
                [
                  '7d5f30a0d1641c0b6980aaf2556b32ce' /* Fiat */
                ].indexOf(
                  new Hash(symbolCategory).md5
                ) !== -1
              ) {
                symbolType = 'FIAT'
              }
              else {
                symbolType = 'TOKEN'
              }

              aggFlowArrayOfObject.push({
                rowKey: new Hash(
                  account + portfolio + contractor + symbol
                ).md5,
                account: account.toUpperCase(),
                portfolio: portfolio.toUpperCase(),
                contractor: contractor.toUpperCase(),
                contractorType: contractorType.toUpperCase(),
                contractorCategory: contractorCategory.toUpperCase(),
                symbol: symbol.toUpperCase(),
                symbolFullName: symbolFullName.toUpperCase(),
                symbolCategory: symbolCategory.toUpperCase(),
                symbolType: symbolType.toUpperCase(),
                quantityInvest: quantityInvest || 0,
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
                priceRest: priceRest || 0,
                priceRestOverflow: priceRestOverflow || 0,
                priceRestWoOverflow: priceRestWoOverflow || 0,
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
                // costOverflow: costOverflow || 0,
                // costIn: costIn || 0,
                // costOut: costOut || 0,
                costInvest: costInvest || 0,
                costRest: costRest || 0,
                costLast: costLast || 0,
                costLock: costLock || 0,
                costRealized: costRealized || 0,
                // costUnlock: costUnlock || 0,
                pnlRealized: pnlRealized || 0,
                pnlUnrealized: pnlUnrealized || 0,
                pnlTotal: pnlTotal || 0,
                quantityRebalance: quantityRebalance || 0,
                // dayInPortfolioAvg,
                isSell: 0,
                useInReport: useInReport || 0,
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

