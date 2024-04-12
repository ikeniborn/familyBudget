import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import { Symbols } from './symbols'
import * as cryptoCompare from '../../restApi/cryptoCompare'
import * as web3space from '../../restApi/web3Space'
// import * as coinGecko from '../../restApi/coinGecko'
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

  updateRowKey() {
    const directionInKey = new Hash('in').md5
    const directionOutKey = new Hash('out').md5
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      let newRowKey
      if (directionInKey === new Hash(rowObject.direction).md5) {
        newRowKey = new Hash(rowObject.registryRowKey + '#2').md5
      } else if (directionOutKey === new Hash(rowObject.direction).md5) {
        if (rowObject.isFee) {
          newRowKey = new Hash(rowObject.registryRowKey + '#3').md5
        } else {
          newRowKey = new Hash(rowObject.registryRowKey + '#1').md5
        }
      }
      rowObject.rowKey = newRowKey
      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  updateIsOverflow() {
    const symbols = new Symbols().workSheet.object
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const overflowArray = rowObject.overflow.split('/')
      const tokenA = overflowArray[0]
      const tokenB = overflowArray[1]
      const tokenAKey = new Hash(tokenA).md5
      const tokenACategory = symbols[tokenAKey]?.symbolCategory || ''
      const tokenBKey = new Hash(tokenB).md5
      const tokenBCategory = symbols[tokenBKey]?.symbolCategory || ''
      if (
        [
          '04a714bd5aaab82a18da3bd93d7dcc4f' /*LP Token*/,
          'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
          '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
        ].indexOf(new Hash(tokenACategory).md5) === -1 &&
        [
          '04a714bd5aaab82a18da3bd93d7dcc4f' /*LP Token*/,
          'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
          '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
        ].indexOf(new Hash(tokenBCategory).md5) === -1 &&
        tokenA !== tokenB
      ) {
        rowObject.isOverflow = true
      } else {
        rowObject.isOverflow = false
      }

      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  updatePair() {
    const directionInKey = new Hash('in').md5
    const directionOutKey = new Hash('out').md5
    const newObject = this.workSheet.arrayOfObject.reduce(
      (newObject, rowObject) => {
        if (!newObject[rowObject.registryRowKey]) {
          newObject[rowObject.registryRowKey] = {}
        }
        if (directionInKey === new Hash(rowObject.direction).md5) {
          newObject[rowObject.registryRowKey]['in'] = rowObject
        } else if (directionOutKey === new Hash(rowObject.direction).md5) {
          if (rowObject.isFee) {
            newObject[rowObject.registryRowKey]['fee'] = rowObject
          } else {
            newObject[rowObject.registryRowKey]['out'] = rowObject
          }
        }
        return newObject
      },
      {}
    )
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      let newOverflow,
        newPriceCoef,
        newOverflowRev,
        newPriceCoefRev,
        outSymbol,
        inSymbol,
        feeSymbol,
        outPrice,
        inPrice,
        feePrice,
        outQuantity,
        inQuantity,
        feeQuantity,
        outOperationKey,
        inOperationKey,
        feeOperationKey

      const registryObject = newObject[rowObject.registryRowKey]
      outSymbol = registryObject['out']?.symbol
      inSymbol = registryObject['in']?.symbol
      feeSymbol = registryObject['fee']?.symbol
      outPrice = registryObject['out']?.price
      inPrice = registryObject['in']?.price
      feePrice = registryObject['fee']?.price
      outQuantity = registryObject['out']?.quantity
      inQuantity = registryObject['in']?.quantity
      feeQuantity = registryObject['fee']?.quantity
      outOperationKey = new Hash(registryObject['out']?.operation).md5
      inOperationKey = new Hash(registryObject['in']?.operation).md5
      feeOperationKey = new Hash(registryObject['fee']?.operation).md5

      if (directionInKey === new Hash(rowObject.direction).md5) {
        if (
          [
            /*buy*/ '0461ebd2b773878eac9f78a891912d65',
            /*sell*/ '8325324b47e1e62a1c2998a640cbdc72',
          ].indexOf(inOperationKey) !== -1
        ) {
          newOverflow = inSymbol + '/' + outSymbol
          newOverflowRev = outSymbol + '/' + inSymbol
          newPriceCoef = inPrice / outPrice
          newPriceCoefRev = outPrice / inPrice
        } else {
          newOverflow = newOverflowRev = inSymbol + '/' + inSymbol
          // newOverflowRev = newOverflow
          newPriceCoef = newPriceCoefRev = inPrice / inPrice
          // newPriceCoefRev = newPriceCoef
        }
      } else if (directionOutKey === new Hash(rowObject.direction).md5) {
        if (rowObject.isFee) {
          newOverflow = newOverflowRev = feeSymbol + '/' + feeSymbol
          // newOverflowRev = newOverflow
          newPriceCoef = newPriceCoefRev = 1
          // newPriceCoefRev = 1
        } else {
          if (
            [
              /*buy*/ '0461ebd2b773878eac9f78a891912d65',
              /*sell*/ '8325324b47e1e62a1c2998a640cbdc72',
            ].indexOf(inOperationKey) !== -1
          ) {
            newOverflow = outSymbol + '/' + inSymbol
            newOverflowRev = inSymbol + '/' + outSymbol
            newPriceCoef = outPrice / inPrice
            newPriceCoefRev = inPrice / outPrice
          } else {
            newOverflow = newOverflowRev = outSymbol + '/' + outSymbol
            // newOverflowRev = outSymbol + '/' + outSymbol
            newPriceCoef = newPriceCoefRev = outPrice / outPrice
            // newPriceCoefRev = outPrice / outPrice
          }
        }
      }
      rowObject.overflow = newOverflow
      rowObject.priceCoef = newPriceCoef
      rowObject.overflowRev = newOverflowRev
      rowObject.priceCoefRev = newPriceCoefRev

      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  /**
   *
   * @param {number} startIndex
   * @param {number} endIndex
   */
  updatePriceCostBTC(startIndex, endIndex) {
    const directionInKey = new Hash('in').md5
    const directionOutKey = new Hash('out').md5
    const newObject = this.workSheet.arrayOfObject.reduce(
      (newObject, rowObject) => {
        if (!newObject[rowObject.registryRowKey]) {
          newObject[rowObject.registryRowKey] = {}
        }
        if (directionInKey === new Hash(rowObject.direction).md5) {
          newObject[rowObject.registryRowKey]['in'] = rowObject
        } else if (directionOutKey === new Hash(rowObject.direction).md5) {
          if (rowObject.isFee) {
            newObject[rowObject.registryRowKey]['fee'] = rowObject
          } else {
            newObject[rowObject.registryRowKey]['out'] = rowObject
          }
        }
        return newObject
      },
      {}
    )
    const newArrayOfObject = this.workSheet.arrayOfObject.map(
      (rowObject, indexRow) => {
        if (indexRow >= startIndex && indexRow <= endIndex) {
          let outSymbol,
            inSymbol,
            feeSymbol,
            outPrice,
            inPrice,
            feePrice,
            priceUSDBTC,
            priceUSDBTCObject,
            priceBTC,
            costBTC,
            outQuantity,
            inQuantity,
            feeQuantity,
            dateTime

          const registryObject = newObject[rowObject.registryRowKey]
          outSymbol = registryObject['out']?.symbol
          inSymbol = registryObject['in']?.symbol
          feeSymbol = registryObject['fee']?.symbol
          outPrice = registryObject['out']?.price
          inPrice = registryObject['in']?.price
          feePrice = registryObject['fee']?.price
          outQuantity = registryObject['out']?.quantity
          inQuantity = registryObject['in']?.quantity
          feeQuantity = registryObject['fee']?.quantity
          dateTime = new Date(registryObject['in']?.dateTime)
          // priceUSDBTCObject = new Price().getHistoricalPrice(
          //   'b460f578-b1ce-950c-287e-dc61d0728e51', /*BTC*/
          //   dateTime,
          //   dateTime
          // ).reduce((object, value) => {
          //   if (!object[value.token_id]) {
          //     object[value.token_id] = value;
          //   }
          //   return object
          // }, {});
          priceUSDBTCObject = {
            'b460f578-b1ce-950c-287e-dc61d0728e51': {
              price_close: new Symbols().workSheet.object[new Hash('btc').md5]?.price
            }
          }
          priceUSDBTC = priceUSDBTCObject['b460f578-b1ce-950c-287e-dc61d0728e51']?.price_close

          if (directionInKey === new Hash(rowObject.direction).md5) {
            priceBTC = inPrice / priceUSDBTC
            costBTC = inPrice / priceUSDBTC * inQuantity
          } else if (directionOutKey === new Hash(rowObject.direction).md5) {
            if (rowObject.isFee) {
              priceBTC = feePrice / priceUSDBTC
              costBTC = feePrice / priceUSDBTC * feeQuantity
            } else {
              priceBTC = outPrice / priceUSDBTC
              costBTC = outPrice / priceUSDBTC * outQuantity
            }
          }

          rowObject.priceBTC = priceBTC
          rowObject.costBTC = costBTC
        }
        return rowObject
      }
    )
    this.workSheet.truncateInsertRows(newArrayOfObject)
  }

  updateHistoricalAveragePriceKey() {
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const newHistoricalAveragePriceKey = new Hash(
        rowObject.account +
        rowObject.portfolio +
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
}

class HistoricalPrice {
  /**
   * Получение средневзвешенной цены покупки токена
   * @param {*} dateTime дата и время
   * @param {*} operationKey ключ операции
   * @param {*} account счет
   * @param {*} portfolio портфолио
   * @param {*} contractor контрагент
   * @param {*} symbol символ
   * @param {*} symbolCategoryKey ключ категории токена
   * @param {object} symbolsObject справочник символов
   * @param {array} transactionsArrayOfObject массив транзакций транзакций [{}]
   * @param {*} isRange признак диапазона
   * @param {*} convert параметр конвертации
   * @param {*} isOverflow признак перелива
   * @param {*} isCurrency признак валюты
   * @returns объект цена и признак исторической цены
   */
  getHistoricalPrice(
    dateTime,
    operationKey,
    account,
    portfolio,
    contractor,
    symbol,
    symbolCategoryKey,
    symbolsObject,
    transactionsArrayOfObject,
    isRange = false,
    convert = 'usd',
    isOverflow = false,
    isCurrency = false
  ) {
    try {
      let historicalPrice = 0
      let isHistoricalAveragePrice = false
      let historicalSource = 'na'
      let historicalCurrencyPrice = 0
      let isHistoricalCurrencyAveragePrice = false
      let historicalCurrencySource = 'na'
      const coin = symbolsObject[new Hash(symbol).md5]
      const sourceKey = new Hash(coin?.source).md5
      const symbolId = coin?.sourceId

      //* Для стабильных токенов
      if (
        'e5e3fd01394b9a81296b75d5a7f4c1a2' === symbolCategoryKey /*stablecoin*/
      ) {

        historicalPrice = 1
        isHistoricalAveragePrice = false
        historicalSource = 'stablecoin'
      }
      //* Для фиата
      else if (
        '7d5f30a0d1641c0b6980aaf2556b32ce' === symbolCategoryKey /*fiat*/
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
          historicalSource = 'fiatCryptocompare'
        }
        else if (
          sourceKey === '9fcc5acecc1e69fad95aa3fec1b715c6' /*web3space*/
        ) {
          const formatDatetime = new FormatDate(dateTime).getFormatDate('yyyy-MM-dd')
          const priceObject = new web3space.Price().getHistoricalPrice(symbolId, formatDatetime, formatDatetime).reduce((object, value) => {
            if (!object[value.token_id]) {
              object[value.token_id] = value
            }
            return object
          }, {})
          historicalPrice = priceObject[symbolId]?.price_close
          isHistoricalAveragePrice = false
          historicalSource = 'fiatWeb3space'
        }
      }
      //* Для токенов
      else {
        //* Расчет средневзвешенной стоимости покупки токена на основании истории покупок для диапазона данных
        const startProcess = new FormatDate()
        if (isRange) {

          const getHistoricalPriceRest = function () {
            const historicalAveragePriceKey = new Hash(account + portfolio + symbol).md5
            //* цена исторических транзакций

            const historicalPriceAgg = transactionsArrayOfObject
              .filter((row) => {
                return (
                  new Date(row.dateTime).valueOf() < new Date(dateTime).valueOf() &&
                  ['84a0f3455dcca894ace136be62efa292' /*transfer*/].indexOf(new Hash(row.operation).md5) === -1 &&
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

                  //* Накопление остатков
                  if (
                    agg.operationCount === 0
                  ) {
                    agg.costRest = tx.cost
                    agg.costRestPrev = agg.costRest
                    agg.priceRest = tx.cost / tx.quantity
                    agg.priceRestPrev = agg.priceRest
                  } else {
                    if (
                      agg.quantityRest > 0
                    ) {
                      if (tx.quantity < 0) {
                        agg.costRest = tx.quantity * agg.priceRestPrev + agg.costRestPrev
                      } else {
                        agg.costRest = tx.cost + agg.costRestPrev
                      }
                      agg.priceRest = agg.costRest / agg.quantityRest || 0
                      agg.priceRestPrev =
                        agg.priceRest || 0
                      agg.costRestPrev =
                        agg.costRest
                    } else {
                      agg.quantityRest = 0
                      agg.costRest = 0
                      agg.costRestPrev = 0
                      agg.priceRest = 0
                      agg.priceRestPrev = 0
                    }
                  }

                  agg.operationCount += 1

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
                  precision: 0,
                  quantityRest: 0,
                  costRest: 0,
                  priceRest: 0,
                  quantityRestPrev: 0,
                  costRestPrev: 0,
                  priceRestPrev: 0,
                  operationCount: 0,
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

            // console.log(
            //   'historicalPriceAgg:'
            //   , 'symbol:', symbol
            //   , 'priceRest:', historicalPriceAgg.priceRest
            //   , 'quantityRest:', historicalPriceAgg.quantityRest
            //   , 'costRest:', historicalPriceAgg.costRest
            // )

            if (historicalPriceAgg.costRest > 1 && historicalPriceAgg.quantityRest > 0) {
              return historicalPriceAgg.priceRest
            } else {
              return 0
            }
          }

          const getExternalPriceRest = function () {
            const formatDatetime = new FormatDate(dateTime).getFormatDate('yyyy-MM-dd')
            const historicalPriceObject = new web3space.Price().getHistoricalPrice(symbolId, formatDatetime, formatDatetime).reduce((object, value) => {
              if (!object[value.token_id]) {
                object[value.token_id] = value
              }
              return object
            }, {})

            // console.log(
            //   ' getExternalPriceRest:'
            //   , 'symbol:', symbol
            //   , 'symbolId:', symbolId
            //   , 'formatDatetime:', formatDatetime
            //   , 'historicalPriceObject:', historicalPriceObject
            // )

            return historicalPriceObject[symbolId]?.price_close || 0
          }

          //* Определение цены токена

          let historicalPriceRest = 0
          let externalPricePriceRest = 0
          let externalCurrencyPrice = 0

          if (
            [
              '84a0f3455dcca894ace136be62efa292' /*transfer*/
              , 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
              , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
            ].indexOf(
              operationKey
            ) !== -1
          ) {
            historicalPriceRest = getHistoricalPriceRest()
            if (historicalPriceRest > 0) {
              historicalPrice = historicalPriceRest
              isHistoricalAveragePrice = true
              historicalSource = 'historyTransactions'
            }
            else {
              historicalPrice = 0
              isHistoricalAveragePrice = false
              historicalSource = 'na'
            }
          }
          else if (
            [
              '0461ebd2b773878eac9f78a891912d65' /*buy*/
              , '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
            ].indexOf(
              operationKey
            ) !== -1
          ) {
            externalPricePriceRest = getExternalPriceRest()
            if (externalPricePriceRest > 0) {
              historicalPrice = externalPricePriceRest
              isHistoricalAveragePrice = false
              historicalSource = 'externalWeb3space'
            }
            else {
              if (coin.price > 0) {
                historicalPrice = coin.price
                isHistoricalAveragePrice = false
                historicalSource = 'externalCurrent'
              } else {
                historicalPrice = 0
                isHistoricalAveragePrice = false
                historicalSource = 'na'
              }
            }


            //* цена валюты для перелива
            if (isCurrency === true && isOverflow === true) {
              if (externalPricePriceRest > 0) {
                historicalCurrencyPrice = externalPricePriceRest
                isHistoricalCurrencyAveragePrice = false
                historicalCurrencySource = 'externalWeb3space'
              } else {
                externalCurrencyPrice = getExternalPriceRest()
                if (externalCurrencyPrice > 0) {
                  historicalCurrencyPrice = externalCurrencyPrice
                  isHistoricalCurrencyAveragePrice = false
                  historicalCurrencySource = 'externalCurrencyWeb3space'
                }
                else {
                  if (coin.price > 0) {
                    historicalPrice = coin.price
                    isHistoricalAveragePrice = false
                    historicalSource = 'externalCurrent'
                  } else {
                    historicalPrice = 0
                    isHistoricalAveragePrice = false
                    historicalSource = 'na'
                  }
                }
              }
            }
          }

          // new Portfolio().log.addMessage(
          //   'getHistoricalPrice:'
          //   , 'ID:' + startProcess.value
          //   , 'Time spent: ' + startProcess.getTimeDiff() + '\n'
          //   + 'symbol:' + symbol + '\n'
          //   + 'isOverflow:' + isOverflow + '\n'
          //   + 'isCurrency:' + isCurrency + '\n'
          //   + 'operationKey:' + operationKey + '\n'
          //   + 'historicalPriceRest:' + historicalPriceRest + '\n'
          //   + 'externalPricePriceRest:' + externalPricePriceRest + '\n'
          //   + 'historicalPrice:', historicalPrice + '\n'
          //   + 'isHistoricalAveragePrice:' + isHistoricalAveragePrice + '\n'
          //   + 'historicalSource:' + historicalSource + '\n'
          //   + 'historicalCurrencyPrice:' + historicalCurrencyPrice + '\n'
          //   + 'isHistoricalCurrencyAveragePrice:' + isHistoricalCurrencyAveragePrice + '\n'
          //   + 'historicalCurrencySource:' + historicalCurrencySource + '\n'
          // )

          // console.log(
          //   'getHistoricalPrice:', '\n'
          //   , 'symbol:', symbol, '\n'
          //   , 'isOverflow:', isOverflow, '\n'
          //   , 'isCurrency:', isCurrency, '\n'
          //   , 'operationKey:', operationKey, '\n'
          //   , 'historicalPriceRest:', historicalPriceRest, '\n'
          //   , 'externalPricePriceRest:', externalPricePriceRest, '\n'
          //   , 'historicalPrice:', historicalPrice, '\n'
          //   , 'isHistoricalAveragePrice:', isHistoricalAveragePrice, '\n'
          //   , 'historicalSource:', historicalSource, '\n'
          //   , 'historicalCurrencyPrice:', historicalCurrencyPrice, '\n'
          //   , 'isHistoricalCurrencyAveragePrice:', isHistoricalCurrencyAveragePrice, '\n'
          //   , 'historicalCurrencySource:', historicalCurrencySource, '\n'
          // )

        }
      }
      return { historicalPrice, isHistoricalAveragePrice, historicalSource, historicalCurrencyPrice, isHistoricalCurrencyAveragePrice, historicalCurrencySource }
    } catch (error) {
      console.error('Transactions.getHistoricalPriceBuy', error.stack)
    }
  }
}
