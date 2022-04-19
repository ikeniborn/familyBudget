import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate, FormatNumber, FormatObject } from '../../utils'
import { Transactions } from './transactions'
import { Log } from './log'
export { Registry }

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName())
  }

  updateTransactions(isRange = false) {
    const startProcess = new FormatDate()
    try {
      const transactions = new Transactions()
      const transactionsArrayOfObject = []
      const updateDate = new Date()
      this.workSheet.arrayOfObject.forEach((rowValues) => {
        let coinQty,
          currencyQty,
          currencyPerCoin,
          coinSymbol,
          symbolPrice,
          project,
          accountRecipient,
          recipient,
          currencySymbol,
          currencyPrice,
          feePrice,
          mainSymbol,
          isDelete,
          isLiquidityPool,
          isFee,
          isLock,
          isBuyPrice,
          isSymbolPrice,
          isCurencyPrice,
          isFeePrice,
          isHistoricalAveragePrice,
          isHistoricalAveragePriceSymbol,
          isHistoricalAveragePriceFeeCurrency,
          isHistoricalAveragePriceCurrency

        const transactionRow = []
        const hhmm = new FormatNumber(
          rowValues.time
        ).getHourAndMinuteFromNumber()
        const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
          .date
        accountRecipient = rowValues.accountRecipient
          ? rowValues.accountRecipient
          : rowValues.accountSender
        recipient = rowValues.recipient ? rowValues.recipient : rowValues.sender
        project = rowValues.project ? rowValues.project : 'No project'
        coinQty = rowValues.coinQty || void 0
        currencyQty = rowValues.currencyQty || void 0
        currencyPerCoin = rowValues.currencyPerCoin || void 0
        coinSymbol = rowValues.coin
        currencySymbol = rowValues.currency
        isLiquidityPool = false
        isDelete = rowValues.isDelete || false
        isFee = false
        isBuyPrice = false
        isLock = false
        isSymbolPrice = false
        isCurencyPrice = false
        isFeePrice = false
        isHistoricalAveragePriceSymbol = false
        isHistoricalAveragePriceFeeCurrency = false
        isHistoricalAveragePriceCurrency = false

        if (!currencyPerCoin && currencyQty) {
          currencyPerCoin = currencyQty / coinQty
        }
        if (!currencyQty && currencyPerCoin) {
          currencyQty = coinQty * currencyPerCoin
        }
        if (!coinQty) {
          coinQty = currencyQty / currencyPerCoin
        }
        //* расчет пулов ликвидности
        if (
          ['Liquidity pool (1)', 'Liquidity pool (2)']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.service).md5) !== -1
        ) {
          coinQty /= 2
          mainSymbol = coinSymbol
          isLiquidityPool = true
        }
        if (
          ['Transfer', 'Write-off', 'Refill']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          currencyPerCoin = 1
          currencySymbol = coinSymbol
          if (
            ['Transfer', 'Write-off']
              .map((m) => (m = new Hash(m).md5))
              .indexOf(new Hash(rowValues.operation).md5) !== -1
          ) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#1').md5,
              direction: 'out',
              account: rowValues.accountSender,
              contractor: rowValues.sender,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty * -1,
              isFee,
              isLock,
              isLiquidityPool,
              isBuyPrice,
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
            })
          }
          if (
            ['Transfer', 'Refill']
              .map((m) => (m = new Hash(m).md5))
              .indexOf(new Hash(rowValues.operation).md5) !== -1
          ) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#2').md5,
              direction: 'in',
              account: accountRecipient,
              contractor: recipient,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty,
              isFee,
              isLock: rowValues.isLock,
              isLiquidityPool,
              isBuyPrice,
              isSymbolPrice: true,
              isFeePrice,

              isCurencyPrice,
            })
          }
        } else if (
          ['Buy']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty * -1,
            isFee,
            isLock,
            isLiquidityPool,
            isBuyPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          })
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            contractor: recipient,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty,
            isFee,
            isLock,
            isLiquidityPool,
            isBuyPrice: true,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          })
        } else if (
          ['Sell']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty * -1,
            isFee,
            isLock,
            isLiquidityPool,
            isBuyPrice,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          })
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty,
            isFee,
            isLock,
            isLiquidityPool,
            isBuyPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          })
        }

        //* Комиссия
        if (rowValues.feeCurrency) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#3').md5,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainSymbol: void 0,
            symbol: rowValues.feeCurrency,
            quantity: rowValues.feeQty * -1,
            isFee: true,
            isLock,
            isLiquidityPool,
            isBuyPrice,
            isFeePrice: true,
            isSymbolPrice,
            isCurencyPrice,
          })
          const historicalPriceBuy = transactions.getHistoricalPriceBuy(
            rowValues.accountSender,
            project,
            dateTime,
            rowValues.feeCurrency,
            isRange
          )
          feePrice = historicalPriceBuy?.historicalPrice
          isHistoricalAveragePriceFeeCurrency =
            historicalPriceBuy?.isHistoricalAveragePrice || false
        }

        //* Расчет текущей или исторической цены покупаемого токена
        if (
          ['Buy', 'Sell', 'Refill', 'Write-off', 'Transfer']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          const historicalPriceBuy = transactions.getHistoricalPriceBuy(
            rowValues.accountSender,
            project,
            dateTime,
            currencySymbol,
            isRange
          )
          isHistoricalAveragePriceCurrency =
            historicalPriceBuy?.isHistoricalAveragePrice || false
          currencyPrice = historicalPriceBuy?.historicalPrice
          isHistoricalAveragePriceSymbol =
            historicalPriceBuy?.isHistoricalAveragePrice || false
          symbolPrice = currencyPrice * currencyPerCoin
        }

        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          let price
          if (tx.isSymbolPrice) {
            price = symbolPrice
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency || false
          } else if (tx.isFeePrice) {
            price = feePrice
            isHistoricalAveragePrice =
              isHistoricalAveragePriceFeeCurrency || false
          } else if (tx.isCurencyPrice) {
            price = currencyPrice
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency || false
          }
          const cost = tx.quantity * price
          const object = {
            rowKey: tx.rowKey,
            sourceKey: new Hash(this.workSheet.sheetName).md5,
            sourceName: new Hash(this.workSheet.sheetName).stringLowerCase,
            dateTime: dateTime,
            direction: tx.isFee ? 'out' : tx.direction.toLowerCase(),
            operation: tx.isFee
              ? 'write-off'
              : rowValues.operation.toLowerCase(),
            account: tx.account.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            project: tx.project.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            mainSymbol: tx.mainSymbol ? tx.mainSymbol.toLowerCase() : void 0,
            symbol: tx.symbol.toLowerCase(),
            quantity: tx.quantity,
            price: price || 0,
            cost: cost || 0,
            comment: rowValues.comment.toString().toLowerCase(),
            registryRowNum: rowValues.rowNum,
            updateDate: updateDate,
            isDelete: isDelete,
            isBuyPrice: tx.isBuyPrice,
            isLiquidityPool: tx.isLiquidityPool,
            isFee: tx.isFee,
            isLock: tx.isLock,
            isHistoricalAveragePrice,
          }
          transactionsArrayOfObject.push(object)
        })
      })

      if (transactionsArrayOfObject.length) {
        transactions.updateTransactions(
          transactionsArrayOfObject,
          this.workSheet.isRange
        )
      }

      this.workSheet.deleteEmptyRows()
    } catch (error) {
      new Log().addError('Registry.updateTransactions', error)
    } finally {
      new Log().addMessage(
        'Registry.updateTransactions',
        'TimeSpent',
        'Time spent: ' + startProcess.getTimeDiff()
      )
    }
  }
}
