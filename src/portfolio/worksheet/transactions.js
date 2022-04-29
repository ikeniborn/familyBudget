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
      this.workSheet.log.addError('Transactions.updateTransactions', error)
    }
  }

  deleteDuplicatesRows() {
    try {
      const newArrayOfObject = Object.values(this.workSheet.object)
      this.workSheet.truncateInsertRows(newArrayOfObject)
    } catch (error) {
      this.workSheet.log.addError('Transactions.deleteDuplicatesRows', error)
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
    currencysymbol,
    isRange = false,
    convert = 'usd'
  ) {
    const startProcess = new FormatDate()
    try {
      let historicalPrice
      let isHistoricalAveragePrice
      historicalPrice = 0
      isHistoricalAveragePrice = false
      const coin = this.prices[new Hash(currencysymbol).md5]
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
          const historicalAveragePriceKey = new Hash(account + currencysymbol)
            .md5
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
            .reduce(
              (agg, tx) => {
                agg.quantity += tx.quantity
                agg.cost += tx.cost
                return agg
              },
              { quantity: 0, cost: 0 }
            )

          //* Расчет средней цены покупки токена
          if (historicalPriceAgg.cost / historicalPriceAgg.quantity) {
            historicalPrice =
              historicalPriceAgg.cost / historicalPriceAgg.quantity
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
      this.workSheet.log.addError('Transactions.getHistoricalPriceBuy', error)
    }
  }
}
