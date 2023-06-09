import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate, FormatNumber, FormatObject } from '../../utils'
import { Transactions, HistoricalPrice } from './transactions'
import { Symbols } from './symbols'
import * as cryptoCompare from '../../restApi/cryptoCompare'
import * as web3space from '../../restApi/web3Space'
export { Registry }

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName())
  }

  /**
   * Получение портфолио
   * @param {string} portfolio портфолио отправителя
   * @param {string} symbolCategoryKey ключ категории символа
   * @returns счет
   */
  getPortfolio(portfolio, symbolCategoryKey) {
    try {
      if (
        /*stablecoin*/ 'e5e3fd01394b9a81296b75d5a7f4c1a2' === symbolCategoryKey
      ) {
        return 'Stablecoin'
      } else if (
        /* fiat */ '7d5f30a0d1641c0b6980aaf2556b32ce' === symbolCategoryKey
      ) {
        return 'Fiat'
      }
      return portfolio
    } catch (error) {
      console.error('Registry.getPortfolio', error.stack)
    }
  }

  /**
   * Определение счета
   * @param {*} accountSender счет отправитель
   * @param {*} accountRecipient счет получатель
   * @returns
   */
  getAccount(accountSender, accountRecipient) {
    try {
      if (accountRecipient) {
        return new Hash(accountRecipient)
      }
      return new Hash(accountSender)
    } catch (error) {
      console.error('Registry.getAccount', error.stack)
    }
  }

  /**
   * получение улюча категории символа
   * @param {*} symbol символ
   * @param {*} symbols справочник символов
   * @returns ключ категории символа
   */
  getSymbolCategoryKey(symbolKey, symbols) {
    try {
      return new Hash(symbols[symbolKey]?.symbolCategory).md5
    } catch (error) {
      console.error('Registry.getSymbolCategoryKey', error.stack)
    }
  }

  /**
   * Получение признака средней цены для расчета истории
   * @param {*} directionKey
   * @param {*} operationKey
   * @param {*} categoryKey
   * @returns признак средней цены
   */
  getIsAvgPrice(directionKey, operationKey, categoryKey) {
    const inKey = new Hash('in').md5
    const outKey = new Hash('out').md5
    if (/*stablecoin*/ 'e5e3fd01394b9a81296b75d5a7f4c1a2' !== categoryKey) {
      if (
        /*Write-off*/ '7b33b9f52598cd60f7aa6ca0082515c4' === operationKey &&
        directionKey === outKey
      ) {
        return true
      } else if (
        [
          /*Transfer*/ '84a0f3455dcca894ace136be62efa292',
          /*Refill*/ 'b4479040173a9f41eeb4e98339f2a21d',
        ].indexOf(operationKey) !== -1 &&
        directionKey === inKey
      ) {
        return true
      } else if (
        [
          /*buy*/ '0461ebd2b773878eac9f78a891912d65',
          /*sell*/ '8325324b47e1e62a1c2998a640cbdc72',
        ].indexOf(operationKey) !== -1
      ) {
        return true
      }
    }
    return false
  }

  updateTransactions(isRange = false) {
    const startProcess = new FormatDate()
    try {
      const symbols = new Symbols().workSheet.object
      const transactions = new Transactions()
      const historicalPrice = new HistoricalPrice()
      const transactionsArrayOfObject = []
      const updateDate = new Date()
      const account = this.workSheet.sheetName
      const directionOut = new Hash('out')
      const directionIn = new Hash('in')
      this.workSheet.arrayOfObject.forEach((rowValues) => {
        let coinQty,
          currencyQty,
          currencyPerCoin,
          coinSymbol,
          coinSymbolCategoryKey,
          symbolPrice,
          currencySymbol,
          currencySymbolCategoryKey,
          currencyPrice,
          portfolioSender,
          accountSender,
          accountSenderKey,
          accountRecipient,
          accountRecipientKey,
          portfolioRecipient,
          sender,
          recipient,
          feeSender,
          feePrice,
          feePortfolio,
          mainSymbol,
          feeCurrency,
          feeCurrencySymbolCategoryKey,
          feeQty,
          isDelete,
          isLiquidityPool,
          isFee,
          isLock,
          isSenderLock,
          isRecipientLock,
          isAvgPrice,
          isSymbolPrice,
          isCurencyPrice,
          isFeePrice,
          isHistoricalAveragePrice,
          isHistoricalAveragePriceSymbol,
          isHistoricalAveragePriceFeeCurrency,
          isHistoricalAveragePriceCurrency,
          operationKey,
          rowKey1,
          rowKey2,
          rowKey3,
          lockStatusKey,
          registryRowKey,
          registryRowKeyTimestamp,
          registryTimestamp,
          symbolPriceCoef,
          currencyPriceCoef,
          priceUSDBTC,
          priceUSDBTCObject,
          isOverflow,
          coinSymbolKey,
          currencySymbolKey

        const transactionRow = []
        const hhmm = new FormatNumber(
          rowValues.time
        ).getHourAndMinuteFromNumber()
        const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
          .date
        registryRowKey = rowValues.rowKey
        const accountSenderTemp = this.getAccount(account, void 0)
        accountSender = accountSenderTemp.stringLowerCase
        accountSenderKey = accountSenderTemp.md5
        const accountRecipientTemp = this.getAccount(
          account,
          rowValues.accountRecipient
        )
        accountRecipient = accountRecipientTemp.stringLowerCase
        accountRecipientKey = accountRecipientTemp.md5
        registryRowKeyTimestamp = rowValues.rowKeyTimestamp
        registryTimestamp = rowValues.timestamp
        operationKey = new Hash(rowValues.operation).md5
        lockStatusKey = new Hash(rowValues.lockStatus).md5
        coinQty =
          typeof rowValues.coinQty === 'number' ? rowValues.coinQty : void 0
        currencyQty =
          typeof rowValues.currencyQty === 'number'
            ? rowValues.currencyQty
            : void 0
        currencyPerCoin =
          typeof rowValues.currencyPerCoin === 'number'
            ? rowValues.currencyPerCoin
            : void 0
        coinSymbol = rowValues.coin
        coinSymbolKey = new Hash(coinSymbol).md5
        coinSymbolCategoryKey = this.getSymbolCategoryKey(
          coinSymbolKey,
          symbols
        )
        currencySymbol = rowValues.currency || rowValues.coin
        currencySymbolKey = new Hash(currencySymbol).md5
        currencySymbolCategoryKey = this.getSymbolCategoryKey(
          currencySymbolKey,
          symbols
        )
        sender = rowValues.sender
        recipient = rowValues.recipient ? rowValues.recipient : rowValues.sender
        feeSender = rowValues.feeSender || rowValues.sender
        feeCurrency = rowValues.feeCurrency
        feeQty = rowValues.feeQty
        isLiquidityPool = false
        isDelete = rowValues.isDelete || false
        isFee = false
        isAvgPrice = false
        isSenderLock = false
        isRecipientLock = false
        isSymbolPrice = false
        isCurencyPrice = false
        isFeePrice = false
        isLock = false
        isHistoricalAveragePriceSymbol = false
        isHistoricalAveragePriceFeeCurrency = false
        isHistoricalAveragePriceCurrency = false
        isOverflow = false

        //* определение перелива
        if (
          [
            '04a714bd5aaab82a18da3bd93d7dcc4f' /*LP Token*/,
            'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
            '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
          ].indexOf(coinSymbolCategoryKey) === -1 &&
          [
            '04a714bd5aaab82a18da3bd93d7dcc4f' /*LP Token*/,
            'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
            '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
          ].indexOf(currencySymbolCategoryKey) === -1 &&
          coinSymbolKey !== currencySymbolKey
        ) {
          isOverflow = true
        }

        //* Расчет пустых значений транзакции количества валюты за один токен, количество токена, количество валюты
        if (!currencyPerCoin && currencyQty) {
          currencyPerCoin = currencyQty / coinQty || void 0
        }
        if (!currencyQty && currencyPerCoin) {
          currencyQty = coinQty * currencyPerCoin || void 0
        }
        if (!coinQty) {
          coinQty = currencyQty / currencyPerCoin || void 0
        }
        //* расчет пулов ликвидности
        if (
          [
            /*Liquidity pool (1), Liquidity pool (2), Liquidity pool (3)*/
            'd70311b68290664f7a442bfa8266dbb9',
            '0dc48f5ee42e5f36afa288473e6e1799',
            '4c110eef236fbdeffe3a353057692a58',
          ].indexOf(new Hash(rowValues.service).md5) !== -1
        ) {
          const countSymbolInLiquidityPool = coinSymbol.split(':').length - 1
          coinQty /= countSymbolInLiquidityPool
          mainSymbol = coinSymbol
          isLiquidityPool = true
        }

        //* расчета статуса блокировки для перемещений
        if (lockStatusKey === 'dce7c4174ce9323904a934a486c41288' /*lock*/) {
          isSenderLock = false
          isRecipientLock = true
        } else if (
          lockStatusKey === '474f3c5e4e32cc95d291d859ae64ef7b' /*unlock*/
        ) {
          isSenderLock = true
          isRecipientLock = false
        } else {
          isSenderLock = false
          isRecipientLock = false
        }
        //* формирование транзакций
        if (
          [
            /*Transfer, Write-off, Refill*/
            '84a0f3455dcca894ace136be62efa292',
            '7b33b9f52598cd60f7aa6ca0082515c4',
            'b4479040173a9f41eeb4e98339f2a21d',
          ].indexOf(operationKey) !== -1
        ) {
          currencyPerCoin = 1

          if (
            [
              /*Transfer, Write-off*/
              '84a0f3455dcca894ace136be62efa292',
              '7b33b9f52598cd60f7aa6ca0082515c4',
            ].indexOf(operationKey) !== -1
          ) {
            portfolioSender = this.getPortfolio(
              rowValues.portfolioSender,
              coinSymbolCategoryKey
            )
            rowKey1 = new Hash(rowValues.rowKey + '#1').md5

            transactionRow.push({
              rowKey: rowKey1,
              account: accountSender,
              accountKey: accountSenderKey,
              direction: directionOut.stringLowerCase,
              portfolio: portfolioSender,
              contractor: sender,
              mainSymbol: void 0,
              symbol: coinSymbol,
              overflow: coinSymbol + '/' + currencySymbol,
              overflowRev: currencySymbol + '/' + coinSymbol,
              quantity: coinQty * -1,
              isFee,
              isLock: isSenderLock,
              isLiquidityPool,
              isAvgPrice: this.getIsAvgPrice(
                directionOut.md5,
                operationKey,
                coinSymbolCategoryKey
              ),
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
              isOverflow: false,
            })
          }
          if (
            [
              /*Transfer, Refill*/
              '84a0f3455dcca894ace136be62efa292',
              'b4479040173a9f41eeb4e98339f2a21d',
            ].indexOf(operationKey) !== -1
          ) {
            portfolioRecipient = this.getPortfolio(
              rowValues.portfolioRecipient || rowValues.portfolioSender,
              coinSymbolCategoryKey
            )
            portfolioSender = this.getPortfolio(
              rowValues.portfolioSender,
              coinSymbolCategoryKey
            )
            rowKey2 = new Hash(rowValues.rowKey + '#2').md5
            transactionRow.push({
              rowKey: rowKey2,
              direction: 'in',
              account: accountRecipient,
              accountKey: accountRecipientKey,
              portfolio: portfolioRecipient,
              contractor: recipient,
              mainSymbol: void 0,
              symbol: coinSymbol,
              overflow: coinSymbol + '/' + currencySymbol,
              overflowRev: currencySymbol + '/' + coinSymbol,
              quantity: coinQty,
              isFee,
              isLock: isRecipientLock,
              isLiquidityPool,
              isAvgPrice: this.getIsAvgPrice(
                directionIn.md5,
                operationKey,
                coinSymbolCategoryKey
              ),
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
              isOverflow: false,
            })
          }
        } else if (
          [/*buy*/ '0461ebd2b773878eac9f78a891912d65'].indexOf(operationKey) !==
          -1
        ) {
          portfolioSender = this.getPortfolio(
            rowValues.portfolioSender,
            currencySymbolCategoryKey
          )
          portfolioRecipient = this.getPortfolio(
            rowValues.portfolioRecipient || rowValues.portfolioSender,
            coinSymbolCategoryKey
          )
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5
          transactionRow.push({
            rowKey: rowKey1,
            direction: directionOut.stringLowerCase,
            account: accountSender,
            accountKey: accountSenderKey,
            portfolio: portfolioSender,
            contractor: sender,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            overflow: currencySymbol + '/' + coinSymbol,
            overflowRev: coinSymbol + '/' + currencySymbol,
            quantity: currencyQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionOut.md5,
              operationKey,
              currencySymbolCategoryKey
            ),
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
            isOverflow,
          })
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5
          transactionRow.push({
            rowKey: rowKey2,
            direction: directionIn.stringLowerCase,
            isLock: rowValues.isLock,
            account: accountRecipient,
            accountKey: accountRecipientKey,
            portfolio: portfolioRecipient,
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            overflow: coinSymbol + '/' + currencySymbol,
            overflowRev: currencySymbol + '/' + coinSymbol,
            quantity: coinQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionIn.md5,
              operationKey,
              coinSymbolCategoryKey
            ),
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
            isOverflow,
          })
        } else if (
          [/*sell*/ '8325324b47e1e62a1c2998a640cbdc72'].indexOf(
            operationKey
          ) !== -1
        ) {
          portfolioSender = this.getPortfolio(
            rowValues.portfolioSender,
            coinSymbolCategoryKey
          )
          portfolioRecipient = this.getPortfolio(
            rowValues.portfolioRecipient || rowValues.portfolioSender,
            currencySymbolCategoryKey
          )
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5
          transactionRow.push({
            rowKey: rowKey1,
            direction: directionOut.stringLowerCase,
            account: accountSender,
            accountKey: accountSenderKey,
            portfolio: portfolioSender,
            contractor: sender,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            overflow: coinSymbol + '/' + currencySymbol,
            overflowRev: currencySymbol + '/' + coinSymbol,
            quantity: coinQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionOut.md5,
              operationKey,
              coinSymbolCategoryKey
            ),
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
            isOverflow,
          })
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5
          transactionRow.push({
            rowKey: rowKey2,
            direction: directionIn.stringLowerCase,
            isLock: rowValues.isLock,
            account: accountRecipient,
            accountKey: accountRecipientKey,
            portfolio: portfolioRecipient,
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            overflow: currencySymbol + '/' + coinSymbol,
            overflowRev: coinSymbol + '/' + currencySymbol,
            quantity: currencyQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionIn.md5,
              operationKey,
              currencySymbolCategoryKey
            ),
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
            isOverflow,
          })
        }

        //* Расчет текущей или исторической цены покупаемого токена

        const historicalPriceBuyCoin = historicalPrice.getHistoricalPrice(
          dateTime,
          accountSender,
          portfolioSender,
          sender,
          currencySymbol,
          currencySymbolCategoryKey,
          symbols,
          Object.values(transactions.workSheet.object),
          isRange
        )

        isHistoricalAveragePriceCurrency =
          historicalPriceBuyCoin?.isHistoricalAveragePrice || false
        isHistoricalAveragePriceSymbol =
          historicalPriceBuyCoin?.isHistoricalAveragePrice || false
        currencyPrice = historicalPriceBuyCoin?.historicalPrice
        symbolPrice = historicalPriceBuyCoin?.historicalPrice * currencyPerCoin
        symbolPriceCoef = symbolPrice / currencyPrice
        currencyPriceCoef = currencyPrice / symbolPrice
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

        //* Комиссия
        if (feeCurrency && feeQty > 0) {
          rowKey3 = new Hash(rowValues.rowKey + '#3').md5
          const feeCurrencyKey = new Hash(rowValues.feeCurrency).md5
          feeCurrencySymbolCategoryKey = this.getSymbolCategoryKey(
            feeCurrencyKey,
            symbols
          )
          feePortfolio = this.getPortfolio(
            rowValues.portfolioSender,
            feeCurrencySymbolCategoryKey
          )
          transactionRow.push({
            rowKey: rowKey3,
            direction: directionOut.stringLowerCase,
            account: accountSender,
            accountKey: accountSenderKey,
            portfolio: feePortfolio,
            contractor: feeSender,
            mainSymbol: void 0,
            symbol: feeCurrency,
            overflow: feeCurrency + '/' + feeCurrency,
            overflowRev: feeCurrency + '/' + feeCurrency,
            quantity: feeQty * -1,
            isFee: true,
            isLock: false,
            isLiquidityPool: false,
            isAvgPrice: this.getIsAvgPrice(
              directionOut.md5,
              /*Write-off*/ '7b33b9f52598cd60f7aa6ca0082515c4',
              feeCurrencySymbolCategoryKey
            ),
            isFeePrice: true,
            isSymbolPrice: false,
            isCurencyPrice: false,
            isOverflow: false,
          })

          //* Расчет текущей или исторической цены комиссии токена

          const historicalPriceBuyFee = historicalPrice.getHistoricalPrice(
            dateTime,
            accountSender,
            feePortfolio,
            feeSender,
            feeCurrency,
            feeCurrencySymbolCategoryKey,
            symbols,
            Object.values(transactions.workSheet.arrayOfObject),
            isRange
          )

          feePrice = historicalPriceBuyFee?.historicalPrice
          isHistoricalAveragePriceFeeCurrency =
            historicalPriceBuyFee?.isHistoricalAveragePrice
        }

        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          let priceUSD, priceCoef, priceBTC, costBTC, costUSD, priceCoefRev
          if (tx.isSymbolPrice) {
            priceUSD = symbolPrice
            priceBTC = symbolPrice/priceUSDBTC 
            isHistoricalAveragePrice = isHistoricalAveragePriceSymbol
            if (
              [
                /*buy*/ '0461ebd2b773878eac9f78a891912d65',
                /*sell*/ '8325324b47e1e62a1c2998a640cbdc72',
              ].indexOf(operationKey) !== -1
            ) {
              priceCoef = symbolPriceCoef
              priceCoefRev = currencyPriceCoef
            } else {
              priceCoef = 1
              priceCoefRev = 1
            }
          } else if (tx.isFeePrice) {
            priceUSD = feePrice
            priceBTC = feePrice/ priceUSDBTC 
            isHistoricalAveragePrice = isHistoricalAveragePriceFeeCurrency
            priceCoef = 1
            priceCoefRev = 1
          } else if (tx.isCurencyPrice) {
            priceUSD = currencyPrice
            priceBTC =  currencyPrice/priceUSDBTC 
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency
            if (
              [
                /*buy*/ '0461ebd2b773878eac9f78a891912d65',
                /*sell*/ '8325324b47e1e62a1c2998a640cbdc72',
              ].indexOf(operationKey) !== -1
            ) {
              priceCoef = currencyPriceCoef
              priceCoefRev = symbolPriceCoef
            } else {
              priceCoef = 1
              priceCoefRev = 1
            }
          }

          costUSD = tx.quantity * priceUSD
          costBTC = tx.quantity * priceBTC

          const object = {
            rowKey: tx.rowKey,
            accountKey: tx.accountKey,
            account: tx.account,
            historicalAveragePriceKey: new Hash(
              tx.account + tx.portfolio + tx.contractor + tx.symbol
            ).md5,
            dateTime: dateTime,
            direction: tx.isFee ? 'out' : tx.direction.toLowerCase(),
            operation: tx.isFee
              ? 'write-off'
              : rowValues.operation.toLowerCase(),
            portfolio: tx.portfolio.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            overflow: tx.overflow ? tx.overflow.toLowerCase() : void 0,
            overflowRev: tx.overflowRev ? tx.overflowRev.toLowerCase() : void 0,
            mainSymbol: tx.mainSymbol ? tx.mainSymbol.toLowerCase() : void 0,
            symbol: tx.symbol.toLowerCase(),
            quantity: tx.quantity,
            price: priceUSD || 0,
            cost: costUSD || 0,
            priceBTC: priceBTC || 0,
            costBTC: costBTC || 0,
            priceCoef: priceCoef || 0,
            priceCoefRev: priceCoefRev || 0,
            comment: rowValues.comment.toString().toLowerCase(),
            updateDate: updateDate,
            isDelete: isDelete,
            isAvgPrice: tx.isAvgPrice,
            isLiquidityPool: tx.isLiquidityPool,
            isFee: tx.isFee,
            isLock: tx.isLock,
            isHistoricalAveragePrice,
            registryRowKey,
            registryRowNum: rowValues.rowNum,
            registryRowId: rowValues.rowId,
            isOverflow: tx.isOverflow,
          }

          //* вставка строки в транзакции
          const registryTimestampCache = this.workSheet.scriptCache.getCache(
            registryRowKeyTimestamp
          )

          if (
            registryTimestamp === registryTimestampCache ||
            !registryTimestampCache
          ) {
            new Promise((resolve) => {
              transactionsArrayOfObject.push(object)
              resolve(object)
            }).then((object) => {
              const rowObject = new FormatObject(
                transactions.workSheet.getRowObject(object)
              ).getCopy()
              transactions.workSheet.object[rowObject.rowKey] = rowObject
            })
          }
        })
      })

      //* вставка даты сохранения
      new Promise((resolve) => {
        if (transactionsArrayOfObject.length) {
          transactions.updateTransactions(
            transactionsArrayOfObject,
            this.workSheet.isRange
          )
          const arrayRegistryRowNum = Object.values(
            transactionsArrayOfObject.reduce((array, row) => {
              if (!array[row.registryRowNum]) {
                array[row.registryRowNum] = {
                  rowNum: row.registryRowNum,
                  rowId: row.registryRowId,
                }
              }
              return array
            }, {})
          )
          resolve(arrayRegistryRowNum)
        }
      }).then((arrayRegistryRowNum) => {
        arrayRegistryRowNum.forEach((object) => {
          this.workSheet.insertRange(
            [
              [
                new FormatDate().getFormatDate('YYYY-MM-dd HH:mm:ss'),
                startProcess.getTimeDiff() + '',
                object.rowId,
              ],
            ],
            object.rowNum,
            this.workSheet.head.dateSaved.idx + 1
          )
        })
      })

      //* удаление пустых строк
      this.workSheet.deleteEmptyRows()
    } catch (error) {
      console.error('Registry.updateTransactions', error.stack)
    }
  }

  deleteDateSaved() {
    this.workSheet.arrayOfObject.forEach((object) => {
      this.workSheet.insertRange(
        [[void 0, void 0]],
        object.rowNum,
        this.workSheet.head.dateSaved.idx + 1
      )
    })
  }

  insertDateSaved() {
    this.workSheet.arrayOfObject.forEach((object) => {
      this.workSheet.insertRange(
        [[new FormatDate().getFormatDate('YYYY-MM-dd HH:mm:ss'), void 0]],
        object.rowNum,
        this.workSheet.head.dateSaved.idx + 1
      )
    })
  }

  validateTransactions() {
    try {
      const transactions = new Transactions()
      const errorKeyArray = []

      const sheetNameArray = new Portfolio()
        .getWorkSheet('Accounts')
        .arrayOfObject.map((m) => m.name)

      sheetNameArray.forEach((sheetName) => {
        const workSheetRegistry = new Portfolio().getWorkSheet(sheetName)
        const workSheetObject = workSheetRegistry.object

        const workSheetKeys = Object.keys(workSheetRegistry.object)

        const accountKey = new Hash(sheetName).md5

        const registryRowKeyArray = transactions.workSheet.arrayOfObject
          .filter((objectRow) => accountKey === objectRow.accountKey)
          .reduce((registryRowKeyArray, objectRow) => {
            if (!registryRowKeyArray.includes(objectRow.registryRowKey)) {
              registryRowKeyArray.push(objectRow.registryRowKey)
            }

            return registryRowKeyArray
          }, [])

        registryRowKeyArray.forEach((registryRowKey) => {
          if (!workSheetKeys.includes(registryRowKey)) {
            errorKeyArray.push(registryRowKey)
          }
        })

        workSheetRegistry.createFilter(workSheetRegistry.range)
      })
      //* удаление пустых ключей
      if (errorKeyArray.length) {
        const deletedTransactions = new Portfolio().getWorkSheet(
          'DeletedTransactions'
        )
        errorKeyArray.forEach((errorKey) => {
          const transactionsRowArray = transactions.workSheet.arrayOfObject.filter(
            (objectRow) => {
              return objectRow.registryRowKey === errorKey
            }
          )
          transactionsRowArray.forEach((row) => {
            deletedTransactions.arrayOfObject.push(
              transactions.workSheet.object[row.rowKey]
            )
            delete transactions.workSheet.object[row.rowKey]
          })
        })
        deletedTransactions.truncateInsertRows(
          deletedTransactions.arrayOfObject
        )
      }

      //* Удаление дубликатов и сортировка
      const newArrayOfObject = Object.values(transactions.workSheet.object)
        .filter((row) => {
          return !row.isDelete
        })
        .sort((a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        })

      transactions.workSheet.truncateInsertRows(newArrayOfObject)
    } catch (error) {
      console.error('Registry.validateTransactions', error.stack)
    }
  }
}
