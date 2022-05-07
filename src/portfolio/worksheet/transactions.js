import { Portfolio } from '../spreadsheet/portfolio'
import { Prices } from './prices'
import { Hash, FormatDate } from '../../utils'
import * as cryptoCompare from '../../restApi/cryptoCompare'
export { Transactions }

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
    this.duplicatesRow = []
    this.prices = new Prices().workSheet.object
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
          const arrayregistryRowKey = []
          arrayOfObject.forEach((tx) => {
            const rowArray = this.workSheet.arrayOfObject.filter(
              (row) => row.rowKey === tx.rowKey
            )
            if (rowArray.length === 1) {
              const oldRow = this.workSheet.object[tx.rowKey]
              tx.rowNum = oldRow.rowNum
              this.workSheet.updateRow(tx)
            } else if (rowArray.length > 1) {
              rowArray.forEach((row, indexRow) => {
                if (!indexRow) {
                  tx.rowNum = row.rowNum
                  this.workSheet.updateRow(tx)
                } else {
                  this.duplicatesRow.push(row)
                }
              })
              arrayregistryRowKey.push(tx.registryRowKey)
            } else {
              this.workSheet.insertRow(tx)
              arrayregistryRowKey.push(tx.registryRowKey)
            }
          })
          resolve(arrayregistryRowKey)
        }).then((arrayregistryRowKey) => {
          if (this.duplicatesRow.length) {
            this.workSheet.deleteRows(this.duplicatesRow)
          }
          this.workSheet.scriptCache.removeAllCache(arrayregistryRowKey)
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

  deleteDuplicatesRows() {
    try {
      const newArrayOfObject = Object.values(this.workSheet.object).sort(
        (a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        }
      )
      this.workSheet.truncateInsertRows(newArrayOfObject)
    } catch (error) {
      console.error('Transactions.deleteDuplicatesRows', error.stack)
    }
  }

  /**
   * Получение средневзвешенной цены покупки токена
   * @param {string} account
   * @param {date} dateTime
   * @param {string} symbol
   * @param {string} convert
   * @param {boolean} isRange
   * @returns
   */
  getHistoricalPriceBuy(
    dateTime,
    account,
    currencySymbol,
    isRange = false,
    convert = 'usd'
  ) {
    try {
      let historicalPrice
      let isHistoricalAveragePrice
      historicalPrice = 0
      isHistoricalAveragePrice = false
      const coin = this.prices[new Hash(currencySymbol).md5]
      const sourceKey = new Hash(coin?.source).md5
      const symbolId = coin?.sourceId
      const categoryKey = new Hash(coin?.symbolCategory).md5
      if ('e5e3fd01394b9a81296b75d5a7f4c1a2' === categoryKey /*stablecoin*/) {
        //* Для стабильных токенов возвращать единицу
        historicalPrice = 1
        isHistoricalAveragePrice = false
      } else if ('7d5f30a0d1641c0b6980aaf2556b32ce' === categoryKey /*fiat*/) {
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
          const historicalAveragePriceKey = new Hash(account + currencySymbol)
            .md5
          const inKey = new Hash('in').md5

          const historicalPriceAgg = this.workSheet.arrayOfObject
            .filter((row) => {
              return (
                new FormatDate(row.dateTime).value <
                  new FormatDate(dateTime).value &&
                historicalAveragePriceKey === row.historicalAveragePriceKey &&
                row.isAvgPrice &&
                !row.isDelete
              )
            })
            .sort((a, b) => {
              if (
                new FormatDate(a.dateTime).value ===
                new FormatDate(b.dateTime).value
              ) {
                a.registryRowId - b.registryRowId
              } else {
                new FormatDate(a.dateTime).value -
                  new FormatDate(b.dateTime).value
              }
            })
            .reduce((agg, tx, indexRow) => {
              const operationKey = new Hash(tx.operation).md5
              const directionKey = new Hash(tx.direction).md5
              if (indexRow === 0) {
                agg = {
                  quantityBuyIn: 0,
                  quantitySellIn: 0,
                  quantityRefillIn: 0,
                  quantityTransferIn: 0,
                  quantityRest: 0,
                  costBuyIn: 0,
                  costSellIn: 0,
                  costRefillIn: 0,
                  costTransferIn: 0,
                  costBalance: 0,
                }
              }

              //* Распределение количества по потокам

              if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
                if (directionKey === inKey) {
                  agg.quantityBuyIn += tx.quantity
                  agg.costBuyIn += tx.cost
                }
              } else if (
                operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
              ) {
                if (directionKey === inKey) {
                  agg.quantitySellIn += tx.quantity
                  agg.costSellIn += tx.cost
                }
              } else if (
                operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
              ) {
                if (directionKey === inKey) {
                  agg.quantityRefillIn += tx.quantity
                  agg.costRefillIn += tx.cost
                }
              } else if (
                operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
              ) {
                if (directionKey === inKey) {
                  agg.quantityTransferIn += tx.quantity
                  agg.costTransferIn += tx.cost
                  agg.dayInPortfolioTransferInSum +=
                    dayInPortfolio * tx.quantity
                }
              }

              agg.quantityRest += tx.quantity

              if (agg.quantityRest !== 0) {
                agg.costBalance += tx.cost
              } else {
                agg.costBalance = 0
              }
              return agg
            }, {})

          const costInFlow =
            historicalPriceAgg.costBuyIn +
            historicalPriceAgg.costSellIn +
            historicalPriceAgg.costRefillIn +
            historicalPriceAgg.costTransferIn
          const quantityInFlow =
            historicalPriceAgg.quantityBuyIn +
            historicalPriceAgg.quantitySellIn +
            historicalPriceAgg.quantityRefillIn +
            historicalPriceAgg.quantityTransferIn
          const priceInFlow = costInFlow / quantityInFlow
          //* текущие остатки
          const costRestInFlow =
            historicalPriceAgg.costBalance < 0
              ? priceInFlow * historicalPriceAgg.quantityRest
              : historicalPriceAgg.costBalance
          const priceRestInFlow =
            costRestInFlow / historicalPriceAgg.quantityRest
          //* Расчет средней цены покупки токена
          if (priceRestInFlow) {
            historicalPrice = priceRestInFlow
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
