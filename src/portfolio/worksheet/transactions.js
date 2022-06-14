import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import * as cryptoCompare from '../../restApi/cryptoCompare'
export { Transactions, HistoricalPrice }

class Transactions {
  constructor(workSheet = '') {
    if (Transactions.exists) {
      return Transactions.instance
    }

    Transactions.instance = this
    Transactions.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Transactions')
    this.forDeleteRow = []
  }

  /**
   *
   * @param {array} arrayOfObject Массив транзакций
   * @param {boolean} isRange Признак обновления диапазона передаваемых данных
   */
  updateTransactions(arrayOfObject = [], isRange = false) {
    try {
      if (isRange) {
        new Promise((resolve) => {
          const rowKeyArray = []
          //* определение всех ключей регистра
          const registryRowKeyArray = arrayOfObject.reduce(
            (registryRowKeyArray, objectRow) => {
              if (!registryRowKeyArray.includes(objectRow.registryRowKey)) {
                registryRowKeyArray.push(objectRow.registryRowKey)
              }
              rowKeyArray.push(objectRow.rowKey)
              return registryRowKeyArray
            },
            []
          )
          //* определение всех ключей транзакций по ключам регистра
          const transactionsRowKeyArray = []
          registryRowKeyArray.forEach((registryRowKey) => {
            this.workSheet.arrayOfObject
              .filter((row) => row.registryRowKey === registryRowKey)
              .map((row) => {
                transactionsRowKeyArray.push(row.rowKey)
              })
          })

          //* проверка ключей транзакций на избыточность
          transactionsRowKeyArray.forEach((transactionsRowKey) => {
            if (rowKeyArray.indexOf(transactionsRowKey) === -1) {
              this.forDeleteRow.push(this.workSheet.object[transactionsRowKey])
            }
          })

          arrayOfObject.forEach((tx) => {
            const rowArray = this.workSheet.arrayOfObject.filter(
              (row) => row.rowKey === tx.rowKey
            )
            if (rowArray.length === 1) {
              const oldRow = this.workSheet.object[tx.rowKey]
              tx.rowNum = oldRow.rowNum
              if (tx.isDelete) {
                this.forDeleteRow.push(tx)
              } else {
                this.workSheet.updateRow(tx)
              }
            } else if (rowArray.length > 1) {
              rowArray.forEach((row, indexRow) => {
                if (!indexRow) {
                  tx.rowNum = row.rowNum
                  this.workSheet.updateRow(tx)
                } else {
                  this.forDeleteRow.push(row)
                }
              })
            } else {
              this.workSheet.insertRow(tx)
            }
          })
          resolve(registryRowKeyArray)
        }).then((registryRowKeyArray) => {
          if (this.forDeleteRow.length) {
            this.workSheet.deleteRows(this.forDeleteRow)
            //* добавление в регистр удаления
            const deletedTransactions = new Portfolio().getWorkSheet(
              'DeletedTransactions'
            )
            this.forDeleteRow.forEach((deleteRowObject) => {
              deletedTransactions.insertRow(deleteRowObject)
            })
          }
          this.workSheet.scriptCache.removeAllCache(registryRowKeyArray)
        })
      } else {
        const sourceKey = arrayOfObject[0].sourceKey
        const otherArray = this.workSheet.arrayOfObject.filter(
          (row) => row.sourceKey !== sourceKey
        )
        const splitArray = [...otherArray, ...arrayOfObject]
        this.workSheet.truncateInsertRows(splitArray)
      }
    } catch (error) {
      console.error('Transactions.updateTransactions', error.stack)
    }
  }

  deleteforDeleteRows() {
    try {
      const newArrayOfObject = Object.values(this.workSheet.object).sort(
        (a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        }
      )
      this.workSheet.truncateInsertRows(newArrayOfObject)
    } catch (error) {
      console.error('Transactions.deleteforDeleteRows', error.stack)
    }
  }

  updateRegistryRowKey() {
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const newRegistryRowKey = new Hash(
        rowObject.registryRowId + rowObject.account
      ).md5
      rowObject.registryRowKey = newRegistryRowKey
      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  updateHistoricalAveragePriceKey() {
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const newHistoricalAveragePriceKey = new Hash(
        rowObject.account +
          rowObject.portfolio +
          rowObject.contractor +
          rowObject.symbol
      ).md5
      rowObject.historicalAveragePriceKey = newHistoricalAveragePriceKey
      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  // recalculateTransactions(startRow, endRow) {
  //   const symbols = new Portfolio().getWorkSheet('Symbols').object
  //   const accounts = new Portfolio().getWorkSheet('Accounts').object
  //   const newArrayOfObject = this.workSheet.arrayOfObject.map(
  //     (rowObject, indexRow) => {
  //       if (indexRow > startRow && indexRow <= endRow) {
  //         if (
  //           [
  //             '84a0f3455dcca894ace136be62efa292',
  //             '7b33b9f52598cd60f7aa6ca0082515c4',
  //             'b4479040173a9f41eeb4e98339f2a21d' /*transfer,write-off, refill*/,
  //           ].indexOf(new Hash(rowObject.operation).md5) !== -1
  //         ) {
  //           const price = this.getHistoricalPriceBuy(
  //             rowObject.dateTime,
  //             accounts[new Hash(rowObject.account).md5]?.mainAccount,
  //             rowObject.symbol,
  //             new Hash(symbols[new Hash(rowObject.symbol).md5]?.symbolCategory)
  //               .md5,
  //             symbols,
  //             true
  //           ).historicalPrice
  //           rowObject.price = price
  //           rowObject.cost = rowObject.quantity * price
  //           rowObject.updateDate = new Date()
  //         }
  //       }
  //       return rowObject
  //     }
  //   )
  //   this.workSheet.truncateInsertRows(newArrayOfObject)
  // }

  updateAccount() {
    const accounts = new Portfolio().getWorkSheet('Accounts').object
    const symbols = new Portfolio().getWorkSheet('Symbols').object
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      if (
        [
          'e5e3fd01394b9a81296b75d5a7f4c1a2',
          '7d5f30a0d1641c0b6980aaf2556b32ce' /*Stablecoin, Fiat*/,
        ].indexOf(
          new Hash(symbols[new Hash(rowObject.symbol).md5]?.symbolCategory).md5
        ) !== -1
      ) {
        rowObject.account =
          accounts[new Hash(rowObject.account).md5]?.mainAccount
        rowObject.updateDate = new Date()
      }

      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  updatePriceBTC() {
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const newRegistryRowKey = new Hash(
        rowObject.registryRowId + rowObject.sourceName
      ).md5
      rowObject.registryRowKey = newRegistryRowKey
      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }
}

class HistoricalPrice {
  /**
   * Получение средневзвешенной цены покупки токена
   * @param {*} dateTime дата и время
   * @param {*} account счет
   * @param {*} portfolio портфолио
   * @param {*} contractor контрагент
   * @param {*} currencySymbol символ
   * @param {*} currencySymbolCategoryKey ключ категории токена
   * @param {object} symbolsObject справочник символов
   * @param {array} transactionsArrayOfObject массив транзакций транзакций [{}]
   * @param {*} isRange признак диапазона
   * @param {*} convert параметр конвертации
   * @returns объект цена и признак исторической цены
   */
  getHistoricalPrice(
    dateTime,
    account,
    portfolio,
    contractor,
    currencySymbol,
    currencySymbolCategoryKey,
    symbolsObject,
    transactionsArrayOfObject,
    isRange = false,
    convert = 'usd'
  ) {
    try {
      let historicalPrice
      let isHistoricalAveragePrice
      historicalPrice = 0
      isHistoricalAveragePrice = false
      const coin = symbolsObject[new Hash(currencySymbol).md5]
      const sourceKey = new Hash(coin?.source).md5
      const symbolId = coin?.sourceId

      if (
        'e5e3fd01394b9a81296b75d5a7f4c1a2' ===
        currencySymbolCategoryKey /*stablecoin*/
      ) {
        //* Для стабильных токенов возвращать единицу
        historicalPrice = 1
        isHistoricalAveragePrice = false
      } else if (
        '7d5f30a0d1641c0b6980aaf2556b32ce' ===
        currencySymbolCategoryKey /*fiat*/
      ) {
        if (
          sourceKey === '1dab445b170a7f0acfccea645a8879e0' /*cryptocompare*/
        ) {
          historicalPrice = new cryptoCompare.Price().getHistoryPrice(
            symbolId,
            dateTime,
            convert
          )
          isHistoricalAveragePrice = false
        }
      } else {
        //* Расчет средневзвешенной стоимости покупки токена на основании истории покупок для диапазона данных
        if (isRange) {
          const historicalAveragePriceKey = new Hash(
            account + portfolio + contractor + currencySymbol
          ).md5
          const inKey = new Hash('in').md5
          const outKey = new Hash('out').md5
          //* цена исторических транзакций

          const historicalPriceAgg = transactionsArrayOfObject
            .filter((row) => {
              return (
                new Date(row.dateTime).valueOf() <
                  new Date(dateTime).valueOf() &&
                historicalAveragePriceKey === row.historicalAveragePriceKey &&
                row.isAvgPrice &&
                !row.isDelete
              )
            })
            .sort((a, b) => {
              return (
                new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
              )
            })
            .reduce(
              (agg, tx) => {
                const operationKey = new Hash(tx.operation).md5
                const directionKey = new Hash(tx.direction).md5
                //* Распределение количества по потокам
                if (
                  operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/
                ) {
                  if (directionKey === inKey) {
                    agg.quantityBuyIn += tx.quantity
                    agg.costBuyIn += tx.cost
                  } else if (directionKey === outKey) {
                    agg.quantityBuyOut += tx.quantity * -1
                    agg.costBuyOut += tx.cost * -1
                  }
                } else if (
                  operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
                ) {
                  if (directionKey === inKey) {
                    agg.quantitySellIn += tx.quantity
                    agg.costSellIn += tx.cost
                  } else if (directionKey === outKey) {
                    agg.quantitySellOut += tx.quantity * -1
                    agg.costSellOut += tx.cost * -1
                  }
                } else if (
                  operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
                ) {
                  if (directionKey === inKey) {
                    agg.quantityRefillIn += tx.quantity
                    agg.costRefillIn += tx.cost
                  }
                } else if (
                  operationKey ===
                  '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
                ) {
                  if (directionKey === outKey) {
                    agg.quantityWriteOffOut += tx.quantity * -1
                    agg.costWriteOffOut += tx.cost * -1
                  }
                } else if (
                  operationKey ===
                  '84a0f3455dcca894ace136be62efa292' /*transfer*/
                ) {
                  if (directionKey === inKey) {
                    agg.quantityTransferIn += tx.quantity
                    agg.costTransferIn += tx.cost
                  } else if (directionKey === outKey) {
                    agg.quantityTransferOut += tx.quantity * -1
                    agg.costTransferOut += tx.cost * -1
                  }
                }

                agg.quantityFlow += tx.quantity

                //* расчет точности
                const precisionArray = tx.quantity.toString().split('.')
                const precision = precisionArray[1]
                  ? [...precisionArray[1].split('')].length
                  : 0
                if (precision > agg.precision && precision <= 6) {
                  agg.precision = precision
                }
                return agg
              },
              {
                quantityBuyIn: 0,
                quantityBuyOut: 0,
                quantitySellIn: 0,
                quantitySellOut: 0,
                quantityRefillIn: 0,
                quantityWriteOffOut: 0,
                quantityTransferIn: 0,
                quantityTransferOut: 0,
                quantityFlow: 0,
                precision: 0,
                costBuyIn: 0,
                costBuyOut: 0,
                costSellIn: 0,
                costSellOut: 0,
                costRefillIn: 0,
                costWriteOffOut: 0,
                costTransferIn: 0,
                costTransferOut: 0,
              }
            )

          //* точность стоимости
          let costPrecisionCoeff = '1'
          for (let i = 0; i < 2; i++) {
            costPrecisionCoeff += '0'
          }
          costPrecisionCoeff = costPrecisionCoeff * 1

          //* точность исторических данных
          let historicalPricePrecisionCoeff = '1'
          for (let i = 0; i < historicalPriceAgg.precision; i++) {
            historicalPricePrecisionCoeff += '0'
          }
          historicalPricePrecisionCoeff = historicalPricePrecisionCoeff * 1

          //* расчет потоков
          const costInFlow =
            Math.round(
              (historicalPriceAgg.costBuyIn +
                historicalPriceAgg.costSellIn +
                historicalPriceAgg.costRefillIn +
                historicalPriceAgg.costTransferIn) *
                costPrecisionCoeff
            ) / costPrecisionCoeff || 0

          const costOutFlow =
            Math.round(
              (historicalPriceAgg.costBuyOut +
                historicalPriceAgg.costSellOut +
                historicalPriceAgg.costWriteOffOut +
                historicalPriceAgg.costTransferOut) *
                costPrecisionCoeff
            ) / costPrecisionCoeff || 0

          const quantityInFlow =
            Math.round(
              (historicalPriceAgg.quantityBuyIn +
                historicalPriceAgg.quantitySellIn +
                historicalPriceAgg.quantityRefillIn +
                historicalPriceAgg.quantityTransferIn) *
                historicalPricePrecisionCoeff
            ) / historicalPricePrecisionCoeff || 0

          const quantityOutFlow =
            Math.round(
              (historicalPriceAgg.quantityBuyOut +
                historicalPriceAgg.quantitySellOut +
                historicalPriceAgg.quantityWriteOffOut +
                historicalPriceAgg.quantityTransferOut) *
                historicalPricePrecisionCoeff
            ) / historicalPricePrecisionCoeff || 0

          //* расчет цены потоков

          const priceInFlow = costInFlow / quantityInFlow
          const priceOutFlow = costOutFlow / quantityOutFlow || 0
          const priceFlowSum =
            priceInFlow * quantityInFlow + priceOutFlow * quantityOutFlow
          const quantityFlowSum = quantityInFlow + quantityOutFlow
          const historicalPricePriceRestFlow =
            priceFlowSum / quantityFlowSum || 0

          // console.log('priceInFlow', priceInFlow)
          // console.log('priceOutFlow', priceOutFlow)
          // console.log('priceFlowSum', priceOutFlow)
          // console.log('quantityFlow', quantityInFlow + quantityOutFlow)
          // console.log(
          //   'historicalPricePriceRestFlow',
          //   historicalPricePriceRestFlow
          // )

          let priceFlow

          if (!historicalPricePriceRestFlow) {
            //* цена текущей транзации
            const currentPrice = transactionsArrayOfObject
              .filter((row) => {
                return (
                  new Date(row.dateTime).valueOf() ===
                    new Date(dateTime).valueOf() &&
                  historicalAveragePriceKey === row.historicalAveragePriceKey &&
                  row.isAvgPrice &&
                  !row.isDelete &&
                  !row.isFee
                )
              })
              .sort((a, b) => {
                return (
                  new Date(a.dateTime).valueOf() -
                  new Date(b.dateTime).valueOf()
                )
              })
              .reduce(
                (agg, tx) => {
                  agg.quantityFlow += tx.quantity
                  agg.costFlow += tx.cost
                  //* расчет точности
                  const precisionArray = tx.quantity.toString().split('.')
                  const precision = precisionArray[1]
                    ? [...precisionArray[1].split('')].length
                    : 0
                  if (precision > agg.precision && precision <= 6) {
                    agg.precision = precision
                  }
                  return agg
                },
                {
                  quantityFlow: 0,
                  precision: 0,
                  costFlow: 0,
                }
              )
            //* расчет цены текущей транзакции

            let currentPricePrecisionCoeff = '1'
            for (let i = 0; i < currentPrice.precision; i++) {
              currentPricePrecisionCoeff += '0'
            }
            currentPricePrecisionCoeff = currentPricePrecisionCoeff * 1

            const currentPriceQuantityRest =
              Math.round(
                currentPrice.quantityFlow * currentPricePrecisionCoeff
              ) / currentPricePrecisionCoeff
            const currentPriceCostRest =
              Math.round(currentPrice.costFlow * costPrecisionCoeff) /
              costPrecisionCoeff
            historicalPricePriceRestFlow
            priceFlow = currentPriceCostRest / currentPriceQuantityRest || 0
          } else {
            priceFlow = historicalPricePriceRestFlow
          }

          // console.log('priceFlow', priceFlow)

          //* Расчет средней цены покупки токена
          if (priceFlow) {
            historicalPrice = priceFlow
            isHistoricalAveragePrice = true
          } else {
            if (
              new FormatDate(dateTime).yyyymmdd === new FormatDate().yyyymmdd &&
              sourceKey === 'b40555dbd3865016ed3f7b4a9bf3b806' /*coingecko*/
            ) {
              //* Получение исторической цены из coinGecko
              historicalPrice = new coinGecko.Price()
                .getMarketsPrice(symbolId)
                .reduce((price, data) => {
                  price = data.current_price
                  return price
                }, 0)
              isHistoricalAveragePrice = false
            } else {
              //* Получение исторической цены из CryptoCompare
              if (
                sourceKey ===
                '1dab445b170a7f0acfccea645a8879e0' /*cryptocompare*/
              ) {
                historicalPrice = new cryptoCompare.Price().getHistoryPrice(
                  symbolId,
                  dateTime,
                  convert
                )
                isHistoricalAveragePrice = true
              }
            }
          }
        }
      }

      return { historicalPrice, isHistoricalAveragePrice }
    } catch (error) {
      console.error('Transactions.getHistoricalPriceBuy', error.stack)
    }
  }
}
