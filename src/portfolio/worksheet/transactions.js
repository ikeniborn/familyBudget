import { Portfolio } from '../spreadsheet/portfolio'
import { Log } from './log'
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
            } else {
              this.workSheet.insertRow(tx)
            }
          })
          resolve()
        }).then(() => {
          this.workSheet.deleteRows(this.duplicatesRow)
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
      new Log().addError('Transactions.updateTransactions', error)
    }
  }

  deleteDuplicatesRows() {
    const newArrayOfObject = Object.values(this.workSheet.object)
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  /**
   * Получение средневзвешенной цены покупки токена
   * @param {string} account
   * @param {*} project
   * @param {*} dateTime
   * @param {*} symbol
   * @param {*} convert
   *    @param {*} isRange
   * @returns
   */
  getHistoricalPriceBuy(
    account,
    project,
    dateTime,
    symbol,
    isRange = false,
    convert = 'usd'
  ) {
    try {
      let historicalPrice = void 0
      const coin = this.prices[new Hash(symbol).md5]
      const sourceKey = new Hash(coin.source).md5
      const id = coin.id
      const symbolTypeKey = new Hash(coin.symbolType).md5
      if (
        ['stablecoin']
          .map((m) => (m = new Hash(m).md5))
          .indexOf(symbolTypeKey) === -1
      ) {
        //* Расчет средневзвешенной стоимости покупки токена на основании истории покупок
        if (isRange) {
          const historicalPriceAgg = this.workSheet.arrayOfObject
            .filter((row) => {
              return (
                new FormatDate(row.dateTime).value <=
                  new FormatDate(dateTime).value &&
                new Hash(account).md5 === new Hash(row.account).md5 &&
                new Hash(project).md5 === new Hash(row.project).md5 &&
                new Hash(symbol).md5 === new Hash(row.symbol).md5 &&
                new Hash('in').md5 === new Hash(row.direction).md5
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

          // Расчет средней цены покупки токена
          Object.entries(historicalPriceAgg).forEach(([account, level0]) => {
            Object.entries(level0).forEach(([project, level1]) => {
              Object.entries(level1).forEach(([symbol, object]) => {
                historicalPrice = object.cost / object.quantity || void 0
              })
            })
          })
        }

        if (historicalPrice) {
          return historicalPrice
        } else {
          if (
            new FormatDate(dateTime).yyyymmdd === new FormatDate().yyyymmdd &&
            sourceKey === new Hash('coingecko').md5
          ) {
            //* Получение исторической цены из coinGecko
            return new coinGecko.Price()
              .getMarketsPrice(id)
              .reduce((price, data) => {
                price = data.current_price
                return price
              }, 0)
          } else {
            //* Получение исторической цены из CryptoCompare
            if (sourceKey === new Hash('cryptocompare').md5) {
              return new cryptoCompare.Price().getHistoryPrice(
                id,
                dateTime,
                convert
              )
            }
          }
        }
      } else {
        // Для стабильных токенов возвращать единицу
        return 1
      }
    } catch (error) {
      new Log().addError('Transactions.getHistoricalPriceBuy', error)
    }
  }
}
