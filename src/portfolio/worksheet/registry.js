import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate, FormatNumber, FormatObject } from '../../utils'
import { Transactions, HistoricalPrice } from './transactions'
import { Symbols } from './symbols'
export { Registry }

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName())
  }

  /**
   * Получение счета
   * @param {string} accountSender счет отправителя
   * @param {string} accountRecipient счет получателя
   * @param {object} accounts справочник счетов
   * @param {string} symbolCategoryKey ключ категории символа
   * @returns счет
   */
  getAccount(accountSender, accountRecipient, accounts, symbolCategoryKey) {
    try {
      const account = accountRecipient ? accountRecipient : accountSender
      if (
        [
          'e5e3fd01394b9a81296b75d5a7f4c1a2',
          '7d5f30a0d1641c0b6980aaf2556b32ce' /*stablecoin, fiat */,
        ].indexOf(symbolCategoryKey) !== -1
      ) {
        return accounts[new Hash(account).md5]?.mainAccount
      }
      return account
    } catch (error) {
      console.error('Registry.getAccount', error.stack)
    }
  }

  /**
   * Получаение основного счета
   * @param {string} account счет
   * @param {object} accounts справочник счетов
   * @returns основной счет
   */
  getMainAccount(account, accounts) {
    try {
      return accounts[new Hash(account).md5]?.mainAccount
    } catch (error) {
      console.error('Registry.getMainAccount', error.stack)
    }
  }

  /**
   * получение улюча категории символа
   * @param {*} symbol символ
   * @param {*} symbols справочник символов
   * @returns ключ категории символа
   */
  getSymbolCategoryKey(symbol, symbols) {
    try {
      return new Hash(symbols[new Hash(symbol).md5]?.symbolCategory).md5
    } catch (error) {
      console.error('Registry.getSymbolCategoryKey', error.stack)
    }
  }

  updateTransactions(isRange = false) {
    const startProcess = new FormatDate()
    try {
      const symbols = new Symbols().workSheet.object
      const accounts = new Portfolio().getWorkSheet('Accounts').object
      const transactions = new Transactions()
      const historicalPrice = new HistoricalPrice()
      const transactionsArrayOfObject = []
      const updateDate = new Date()
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
          accountSender,
          accountRecipient,
          mainAccountSender,
          mainAccountRecipient,
          sender,
          recipient,
          feeSender,
          feePrice,
          feeAccount,
          feeMainAccount,
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
          registryTimestamp

        const transactionRow = []
        const hhmm = new FormatNumber(
          rowValues.time
        ).getHourAndMinuteFromNumber()
        const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
          .date
        registryRowKey = rowValues.rowKey
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
        coinSymbolCategoryKey = this.getSymbolCategoryKey(coinSymbol, symbols)
        currencySymbol = rowValues.currency || rowValues.coin
        currencySymbolCategoryKey = this.getSymbolCategoryKey(
          currencySymbol,
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
          // currencySymbol = coinSymbol
          if (
            [
              /*Write-off, Refill*/
              '7b33b9f52598cd60f7aa6ca0082515c4',
              'b4479040173a9f41eeb4e98339f2a21d',
            ].indexOf(operationKey) !== -1
          ) {
            isAvgPrice = true
          }
          if (
            [
              /*Transfer, Write-off*/
              '84a0f3455dcca894ace136be62efa292',
              '7b33b9f52598cd60f7aa6ca0082515c4',
            ].indexOf(operationKey) !== -1
          ) {
            accountSender = this.getAccount(
              rowValues.accountSender,
              void 0,
              accounts,
              coinSymbolCategoryKey
            )
            mainAccountSender = this.getMainAccount(accountSender, accounts)
            rowKey1 = new Hash(rowValues.rowKey + '#1').md5
            transactionRow.push({
              rowKey: rowKey1,
              direction: 'out',
              account: accountSender,
              mainAccount: mainAccountSender,
              contractor: sender,
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty * -1,
              isFee,
              isLock: isSenderLock,
              isLiquidityPool,
              isAvgPrice,
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
            })
          }
          if (
            [
              /*Transfer, Refill*/
              '84a0f3455dcca894ace136be62efa292',
              'b4479040173a9f41eeb4e98339f2a21d',
            ].indexOf(operationKey) !== -1
          ) {
            accountRecipient = this.getAccount(
              rowValues.accountSender,
              rowValues.accountRecipient,
              accounts,
              coinSymbolCategoryKey
            )
            mainAccountRecipient = this.getMainAccount(
              accountRecipient,
              accounts
            )
            rowKey2 = new Hash(rowValues.rowKey + '#2').md5
            transactionRow.push({
              rowKey: rowKey2,
              direction: 'in',
              account: accountRecipient,
              mainAccount: mainAccountRecipient,
              contractor: recipient,
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty,
              isFee,
              isLock: isRecipientLock,
              isLiquidityPool,
              isAvgPrice: true,
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
            })
          }
        } else if (
          [/*buy*/ '0461ebd2b773878eac9f78a891912d65'].indexOf(operationKey) !==
          -1
        ) {
          accountSender = this.getAccount(
            rowValues.accountSender,
            void 0,
            accounts,
            currencySymbolCategoryKey
          )
          accountRecipient = this.getAccount(
            rowValues.accountSender,
            rowValues.accountRecipient,
            accounts,
            coinSymbolCategoryKey
          )
          mainAccountSender = this.getMainAccount(accountSender, accounts)
          mainAccountRecipient = this.getMainAccount(accountRecipient, accounts)
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5
          transactionRow.push({
            rowKey: rowKey1,
            direction: 'out',
            account: accountSender,
            mainAccount: mainAccountSender,
            contractor: sender,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          })
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5
          transactionRow.push({
            rowKey: rowKey2,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            mainAccount: mainAccountRecipient,
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: true,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          })
        } else if (
          [/*sell*/ '8325324b47e1e62a1c2998a640cbdc72'].indexOf(
            operationKey
          ) !== -1
        ) {
          accountSender = this.getAccount(
            rowValues.accountSender,
            void 0,
            accounts,
            coinSymbolCategoryKey
          )
          accountRecipient = this.getAccount(
            rowValues.accountSender,
            rowValues.accountRecipient,
            accounts,
            currencySymbolCategoryKey
          )

          mainAccountSender = this.getMainAccount(accountSender, accounts)
          mainAccountRecipient = this.getMainAccount(accountRecipient, accounts)
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5
          transactionRow.push({
            rowKey: rowKey1,
            direction: 'out',
            account: accountSender,
            mainAccount: mainAccountSender,
            contractor: sender,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: true,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          })
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5
          transactionRow.push({
            rowKey: rowKey2,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            mainAccount: mainAccountRecipient,
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          })
        }

        //* Расчет текущей или исторической цены покупаемого токена
        const historicalPriceBuyCoin = historicalPrice.getHistoricalPrice(
          dateTime,
          accountSender,
          sender,
          currencySymbol,
          currencySymbolCategoryKey,
          symbols,
          transactions.workSheet.arrayOfObject,
          isRange
        )

        isHistoricalAveragePriceCurrency =
          historicalPriceBuyCoin?.isHistoricalAveragePrice || false
        isHistoricalAveragePriceSymbol =
          historicalPriceBuyCoin?.isHistoricalAveragePrice || false
        currencyPrice = historicalPriceBuyCoin?.historicalPrice
        symbolPrice = historicalPriceBuyCoin?.historicalPrice * currencyPerCoin

        //* Комиссия
        if (rowValues.feeCurrency) {
          rowKey3 = new Hash(rowValues.rowKey + '#3').md5
          feeCurrencySymbolCategoryKey = this.getSymbolCategoryKey(
            rowValues.feeCurrency,
            symbols
          )
          feeAccount = this.getAccount(
            rowValues.accountSender,
            void 0,
            accounts,
            feeCurrencySymbolCategoryKey
          )
          feeMainAccount = this.getMainAccount(feeAccount, accounts)
          if (
            'e5e3fd01394b9a81296b75d5a7f4c1a2' !==
            feeCurrencySymbolCategoryKey /*stablecoin*/
          ) {
            isAvgPrice = true
          }
          transactionRow.push({
            rowKey: rowKey3,
            direction: 'out',
            account: feeAccount,
            mainAccount: feeMainAccount,
            contractor: feeSender,
            mainSymbol: void 0,
            symbol: feeCurrency,
            quantity: feeQty * -1,
            isFee: true,
            isLock: false,
            isLiquidityPool: false,
            isAvgPrice,
            isFeePrice: true,
            isSymbolPrice: false,
            isCurencyPrice: false,
          })

          //* Расчет текущей или исторической цены комиссии токена

          const historicalPriceBuyFee = historicalPrice.getHistoricalPrice(
            dateTime,
            feeAccount,
            feeSender,
            feeCurrency,
            feeCurrencySymbolCategoryKey,
            symbols,
            transactions.workSheet.arrayOfObject,
            isRange
          )

          feePrice = historicalPriceBuyFee?.historicalPrice
          isHistoricalAveragePriceFeeCurrency =
            historicalPriceBuyFee?.isHistoricalAveragePrice
        }

        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          let price
          if (tx.isSymbolPrice) {
            price = symbolPrice
            isHistoricalAveragePrice = isHistoricalAveragePriceSymbol
          } else if (tx.isFeePrice) {
            price = feePrice
            isHistoricalAveragePrice = isHistoricalAveragePriceFeeCurrency
          } else if (tx.isCurencyPrice) {
            price = currencyPrice
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency
          }
          console.log(tx.account, tx.symbol, isHistoricalAveragePrice)
          const cost = tx.quantity * price
          const object = {
            rowKey: tx.rowKey,
            sourceKey: new Hash(this.workSheet.sheetName).md5,
            sourceName: new Hash(this.workSheet.sheetName).stringLowerCase,
            historicalAveragePriceKey: new Hash(
              tx.account + tx.contractor + tx.symbol
            ).md5,
            dateTime: dateTime,
            direction: tx.isFee ? 'out' : tx.direction.toLowerCase(),
            operation: tx.isFee
              ? 'write-off'
              : rowValues.operation.toLowerCase(),
            account: tx.account.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            mainSymbol: tx.mainSymbol ? tx.mainSymbol.toLowerCase() : void 0,
            symbol: tx.symbol.toLowerCase(),
            quantity: tx.quantity,
            price: price || 0,
            cost: cost || 0,
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
          }

          //* вставка строки в транзакции
          const registryTimestampCache = this.workSheet.scriptCache.getCache(
            registryRowKeyTimestamp
          )

          if (
            registryTimestamp === registryTimestampCache ||
            !registryTimestampCache
          ) {
            transactionsArrayOfObject.push(object)
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

  validateTransactions() {
    try {
      const transactions = new Transactions()
      const errorKeyArray = []
      const sheetNameArray = this.workSheet.spreadSheet
        .getSheets()
        .map((sheet) => sheet.getName())
        .filter((sheetName) => sheetName.match('Registry'))

      sheetNameArray.forEach((sheetName) => {
        const workSheetRegistry = new Portfolio().getWorkSheet(sheetName)
        const workSheetObject = workSheetRegistry.object
        const sourceKey = new Hash(sheetName).md5

        const registryRowKeyArray = transactions.workSheet.arrayOfObject
          .filter((objectRow) => sourceKey === objectRow.sourceKey)
          .reduce((registryRowKeyArray, objectRow) => {
            if (!registryRowKeyArray.includes(objectRow.registryRowKey)) {
              registryRowKeyArray.push(objectRow.registryRowKey)
            }

            return registryRowKeyArray
          }, [])

        registryRowKeyArray.forEach((registryRowKey) => {
          if (!workSheetObject[registryRowKey]) {
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
