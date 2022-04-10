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
    try {
      const transactions = new Transactions()
      const transactionsArrayOfObject = []
      const updateDate = new Date()
      const services = new Portfolio().getWorkSheet('services').object
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
          cyrrencyPrice,
          mainSymbol,
          isLiquidityPool,
          isFee,
          feeCurrencyPrice,
          isLock
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
        isFee = false
        isLock = false

        if (!currencyPerCoin && currencyQty) {
          currencyPerCoin = currencyQty / coinQty
        }
        if (!currencyQty && currencyPerCoin) {
          currencyQty = coinQty * currencyPerCoin
        }
        if (!coinQty) {
          coinQty = currencyQty / currencyPerCoin
        }
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
              isPrice:
                ['Write-off']
                  .map((m) => (m = new Hash(m).md5))
                  .indexOf(new Hash(rowValues.operation).md5) !== -1
                  ? true
                  : false,
              isLiquidityPool,
              isFee,
              isLock:
                new Hash(
                  services[new Hash(rowValues.service).md5]?.symbolStatus
                ).md5 === new Hash('lock').md5 &&
                new Hash([rowValues.platform]).md5 ===
                  new Hash(rowValues.sender).md5 &&
                ['Transfer']
                  .map((m) => (m = new Hash(m).md5))
                  .indexOf(new Hash(rowValues.operation).md5) !== -1
                  ? true
                  : false,
              direction: 'out',
              account: rowValues.accountSender,
              contractor: rowValues.sender,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty * -1,
            })
          }
          if (
            ['Transfer', 'Refill']
              .map((m) => (m = new Hash(m).md5))
              .indexOf(new Hash(rowValues.operation).md5) !== -1
          ) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#2').md5,
              isPrice:
                ['Refill']
                  .map((m) => (m = new Hash(m).md5))
                  .indexOf(new Hash(rowValues.operation).md5) !== -1
                  ? true
                  : false,
              isLiquidityPool,
              isFee,
              isLock:
                new Hash(
                  services[new Hash(rowValues.service).md5]?.symbolStatus
                ).md5 === new Hash('lock').md5 &&
                new Hash([rowValues.platform]).md5 ===
                  new Hash(recipient).md5 &&
                ['Transfer']
                  .map((m) => (m = new Hash(m).md5))
                  .indexOf(new Hash(rowValues.operation).md5) !== -1
                  ? true
                  : false,
              direction: 'in',
              account: accountRecipient,
              contractor: recipient,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty,
            })
          }
        } else if (
          ['Buy']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            isPrice: false,
            direction: 'out',
            isLiquidityPool,
            isFee,
            isLock,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty * -1,
          })
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            isPrice: true,
            direction: 'in',
            isLiquidityPool,
            isFee,
            isLock,
            account: accountRecipient,
            contractor: recipient,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty,
          })
        } else if (
          ['Sell']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            isPrice: true,
            isLiquidityPool,
            direction: 'out',
            isFee,
            isLock,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty * -1,
          })
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            isPrice: false,
            isLiquidityPool,
            direction: 'in',
            isFee,
            isLock,
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty,
          })
        }

        //* Комиссия
        if (rowValues.feeCurrency) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#3').md5,
            isPrice: false,
            isLiquidityPool: false,
            isFee: true,
            isLock,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainSymbol: void 0,
            symbol: rowValues.feeCurrency,
            quantity: rowValues.feeQty * -1,
          })
          feeCurrencyPrice = transactions.getHistoricalPriceBuy(
            rowValues.accountSender,
            project,
            dateTime,
            rowValues.feeCurrency,
            isRange
          )
        }

        //* Расчет текущей или исторической цены покупаемого токена
        if (
          ['Buy', 'Sell', 'Refill', 'Write-off', 'Transfer']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          cyrrencyPrice = transactions.getHistoricalPriceBuy(
            rowValues.accountSender,
            project,
            dateTime,
            currencySymbol,
            isRange
          )
          symbolPrice = cyrrencyPrice * currencyPerCoin
        }

        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          let price
          if (tx.isPrice && !tx.isFee) {
            price = symbolPrice
          } else if (tx.isFee) {
            price = feeCurrencyPrice
          } else {
            price = cyrrencyPrice
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
            isDelete: rowValues.isDelete,
            isPrice: tx.isPrice,
            isLiquidityPool: tx.isLiquidityPool,
            isFee: tx.isFee,
            isLock: tx.isLock,
          }
          transactionsArrayOfObject.push(object)
          // if (tx.isPrice && !tx.isLiquidityPool) {
          // if (tx.isPrice) {
          // historicalPricesArrayOfObject.push(new FormatObject(object).getCopy())
          // }
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
    }
  }
}
