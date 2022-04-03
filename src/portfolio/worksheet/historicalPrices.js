import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import { Log } from './log'
import { Prices } from './prices'
import * as cryptoCompare from '../../restApi/cryptoCompare'
export { HistoricalPrices }

class HistoricalPrices {
  constructor(workSheet = '') {
    if (HistoricalPrices.exists) {
      return HistoricalPrices.instance
    }
    HistoricalPrices.instance = this
    HistoricalPrices.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('HistoricalPrices')
  }
  /**
   * Обновление или добавление новой исторической записи цены токена
   * @param {*} arrayOfObject
   * @param {*} isRange
   */
  updateHistoricalPrices(arrayOfObject = [], isRange = false) {
    try {
      if (isRange) {
        arrayOfObject.forEach((tx) => {
          const rowKey = new Hash(
            new FormatDate(tx.dateTime).value +
              tx.operation +
              tx.direction +
              tx.account +
              tx.project +
              tx.symbol
          ).md5
          const oldRow = this.workSheet.object[rowKey]
          const positiveQuantity =
            new Hash(tx.direction).md5 === new Hash('out').md5
              ? tx.quantity * -1
              : tx.quantity
          if (oldRow?.rowKey) {
            tx.quantity = positiveQuantity
            tx.rowNum = oldRow.rowNum
            tx.rowKey = rowKey
            this.workSheet.updateRow(tx)
          } else {
            tx.quantity = positiveQuantity
            tx.rowKey = rowKey
            this.workSheet.insertRow(tx)
          }
        })
      } else {
        this.workSheet.truncateInsertRows(arrayOfObject)
      }
    } catch (error) {
      new Log().addError('HistoricalPrices.updateHistoricalPrices', error)
    }
  }

  /**
   * Получение средневзвешенной цены покупки токена
   * @param {string} account
   * @param {*} project
   * @param {*} dateTime
   * @param {*} symbol
   * @param {*} convert
   * @returns
   */
  getHistoricalPriceBuy(account, project, dateTime, symbol, convert = 'usd') {
    try {
      let historicalPrice = void 0
      const prices = new Prices().workSheet.object
      const coin = prices[new Hash(symbol).md5]
      const sourceKey = new Hash(coin.source).md5
      const id = coin.id
      const symbolTypeKey = new Hash(coin.symbolType).md5
      if (
        ['stablecoin']
          .map((m) => (m = new Hash(m).md5))
          .indexOf(symbolTypeKey) === -1
      ) {
        // Расчет средневзвешенной стоимости покупки токена на основании истории покупок
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
      new Log().addError('HistoricalPrices.getHistoricalPriceBuy', error)
    }
  }
}
