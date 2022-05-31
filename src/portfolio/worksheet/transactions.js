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
        rowObject.registryRowId + rowObject.sourceName
      ).md5
      rowObject.registryRowKey = newRegistryRowKey
      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  updateHistoricalAveragePriceKey() {
    const accounts = new Portfolio().getWorkSheet('Accounts').object
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const mainAccount = accounts[new Hash(rowObject.account).md5].mainAccount
      const newHistoricalAveragePriceKey = new Hash(
        rowObject.account + rowObject.contractor + rowObject.symbol
      ).md5
      rowObject.historicalAveragePriceKey = newHistoricalAveragePriceKey
      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  recalculateTransactions(startRow, endRow) {
    const symbols = new Portfolio().getWorkSheet('Symbols').object
    const accounts = new Portfolio().getWorkSheet('Accounts').object
    const newArrayOfObject = this.workSheet.arrayOfObject.map(
      (rowObject, indexRow) => {
        if (indexRow > startRow && indexRow <= endRow) {
          if (
            [
              '84a0f3455dcca894ace136be62efa292',
              '7b33b9f52598cd60f7aa6ca0082515c4',
              'b4479040173a9f41eeb4e98339f2a21d' /*transfer,write-off, refill*/,
            ].indexOf(new Hash(rowObject.operation).md5) !== -1
          ) {
            const price = this.getHistoricalPriceBuy(
              rowObject.dateTime,
              accounts[new Hash(rowObject.account).md5]?.mainAccount,
              rowObject.symbol,
              new Hash(symbols[new Hash(rowObject.symbol).md5]?.symbolCategory)
                .md5,
              symbols,
              true
            ).historicalPrice
            rowObject.price = price
            rowObject.cost = rowObject.quantity * price
            rowObject.updateDate = new Date()
          }
        }
        return rowObject
      }
    )
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

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
}

class HistoricalPrice {
  /**
   * Получение средневзвешенной цены покупки токена
   * @param {*} dateTime дата и время
   * @param {*} account счет
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
            account + contractor + currencySymbol
          ).md5
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
                agg.quantityRest += tx.quantity
                agg.costRest += tx.cost
                //* расчет точности
                const precisionArray = tx.quantity.toString().split('.')
                const precision = precisionArray[1]
                  ? [...precisionArray[1].split('')].length
                  : 0
                if (precision > agg.precision) {
                  agg.precision = precision
                }
                return agg
              },
              {
                quantityRest: 0,
                costRest: 0,
                precision: 0,
              }
            )
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
                new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
              )
            })
            .reduce(
              (agg, tx) => {
                agg.quantityRest += tx.quantity
                agg.costRest += tx.cost
                //* расчет точности
                const precisionArray = tx.quantity.toString().split('.')
                const precision = precisionArray[1]
                  ? [...precisionArray[1].split('')].length
                  : 0
                if (precision > agg.precision) {
                  agg.precision = precision
                }
                return agg
              },
              {
                quantityRest: 0,
                costRest: 0,
                precision: 0,
              }
            )
          //* исторические данные

          let historicalPricePrecisionCoeff = '1'
          for (let i = 0; i < historicalPriceAgg.precision; i++) {
            historicalPricePrecisionCoeff += '0'
          }
          historicalPricePrecisionCoeff = historicalPricePrecisionCoeff * 1

          const historicalPriceQuantityRest =
            Math.round(
              historicalPriceAgg.quantityRest * historicalPricePrecisionCoeff
            ) / historicalPricePrecisionCoeff
          const historicalPriceCostRest =
            Math.round(historicalPriceAgg.costRest).toFixed(0) * 1
          //* данные транзакции

          let currentPricePrecisionCoeff = '1'
          for (let i = 0; i < currentPrice.precision; i++) {
            currentPricePrecisionCoeff += '0'
          }
          currentPricePrecisionCoeff = currentPricePrecisionCoeff * 1

          const currentPriceQuantityRest =
            Math.round(currentPrice.quantityRest * currentPricePrecisionCoeff) /
            currentPricePrecisionCoeff
          const currentPriceCostRest =
            Math.round(currentPrice.costRest).toFixed(0) * 1
          //* расчет цены
          const priceRestFlow =
            Math.round(costRest * quantityRest).toFixed(0) > 0
              ? historicalPriceCostRest / historicalPriceQuantityRest
              : currentPriceCostRest / currentPriceQuantityRest

          // console.log(account, contractor, currencySymbol)
          // console.log('currentPrice.quantityRest', currentPrice.quantityRest)
          // console.log('currentPrice.costRest', currentPrice.costRest)
          // console.log(
          //   'historicalPriceAgg.quantityRest',
          //   historicalPriceAgg.quantityRest
          // )

          // console.log(
          //   'historicalPriceAgg.costRest',
          //   historicalPriceAgg.costRest
          // )
          // console.log('priceRestFlow', priceRestFlow)

          //* Расчет средней цены покупки токена
          if (priceRestFlow) {
            historicalPrice = priceRestFlow
            isHistoricalAveragePrice = historicalPriceAgg.quantityRest
              ? true
              : false
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

/* 
// console.log('quantityRest', historicalPriceAgg.quantityRest)
// console.log('costBalance', historicalPriceAgg.costBalance)
// console.log('quantityInFlow', quantityInFlow)
// console.log('priceInFlow', priceInFlow)
// console.log('costInFlow', costInFlow)
// console.log('costRestInFlow', costRestInFlow)
// console.log('priceRestInFlow', priceRestInFlow)
*/
