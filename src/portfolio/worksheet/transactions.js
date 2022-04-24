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
          const arrayKeys = []
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
              arrayKeys.push(tx.rowKey)
            } else {
              this.workSheet.insertRow(tx)
              arrayKeys.push(tx.rowKey)
            }
          })
          resolve(arrayKeys)
        }).then((data) => {
          this.workSheet.deleteRows(this.duplicatesRow)
          this.workSheet.scriptCache.removeAllCache(data)
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
   * @param {string} project
   * @param {date} dateTime
   * @param {string} symbol
   * @param {string} convert
   * @param {boolean} isRange
   * @returns
   */
  getHistoricalPriceBuy(
    dateTime,
    account,
    project,
    currencysymbol,
    isRange = false,
    convert = 'usd'
  ) {
    try {
      let historicalPrice
      let isHistoricalAveragePrice
      historicalPrice = 0
      isHistoricalAveragePrice = false
      const coin = this.prices[new Hash(currencysymbol).md5]
      const sourceKey = new Hash(coin?.source).md5
      const symbolId = coin?.id
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
          const historicalPriceAgg = this.workSheet.arrayOfObject
            .filter((row) => {
              return (
                new FormatDate(row.dateTime).value <=
                  new FormatDate(dateTime).value &&
                new Hash(account + project + currencysymbol).md5 ===
                  new Hash(row.account + row.project + row.symbol).md5 &&
                row.isAvgPrice &&
                !row.isDelete
              )
            })
            .reduce((agg, tx) => {
              if (!agg[tx.account]) {
                agg[tx.account] = {}
              }
              if (!agg[tx.account][tx.project]) {
                agg[tx.account][tx.project] = {}
              }
              if (!agg[tx.account][tx.project][tx.symbol]) {
                agg[tx.account][tx.project][tx.symbol] = {
                  quantity: 0,
                  cost: 0,
                }
              }
              agg[tx.account][tx.project][tx.symbol].quantity += tx.quantity
              agg[tx.account][tx.project][tx.symbol].cost +=
                tx.quantity * tx.price
              return agg
            }, {})

          //* Расчет средней цены покупки токена
          Object.values(historicalPriceAgg).forEach((level0) => {
            Object.values(level0).forEach((level1) => {
              Object.values(level1).forEach((object) => {
                historicalPrice = object.cost / object.quantity || void 0
                isHistoricalAveragePrice = true
              })
            })
          })
          if (historicalPrice) {
            return { historicalPrice, isHistoricalAveragePrice }
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
            return { historicalPrice, isHistoricalAveragePrice }
          }
        }
      }
      return { historicalPrice, isHistoricalAveragePrice }
    } catch (error) {
      this.workSheet.log.addError('Transactions.getHistoricalPriceBuy', error)
    }
  }
}
