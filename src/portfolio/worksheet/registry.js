import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate, FormatNumber, FormatObject } from '../../utils'
import { HistoricalPrices } from './historicalPrices'
import { Transactions } from './transactions'
import { Log } from './log'
export { Registry }

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName())
  }

  updateTransactions() {
    try {
      const transactionsArrayOfObject = []
      const historicalPricesArrayOfObject = []
      const updateDate = new Date()
      const historicalPrices = new HistoricalPrices()
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
          isLiquidityPool
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
        coinQty = rowValues.coinQty
        currencyQty = rowValues.currencyQty
        coinSymbol = rowValues.coin
        currencySymbol = rowValues.currency
        isLiquidityPool = false
        if (
          ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !==
          -1
        ) {
          currencyPerCoin = 1
          currencySymbol = coinSymbol
          if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#1').md5,
              isPrice: false,
              isLiquidityPool,
              direction: 'out',
              account: rowValues.accountSender,
              contractor: rowValues.sender,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty * -1,
            })
          }
          if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#2').md5,
              isPrice:
                ['Refill'].indexOf(rowValues.operation) !== -1 ? true : false,
              isLiquidityPool,
              direction: 'in',
              account: accountRecipient,
              contractor: recipient,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty,
            })
          }
        } else if (['Buy'].indexOf(rowValues.operation) !== -1) {
          if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowValues.currencyPerCoin
          }
          if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowValues.currencyPerCoin
          }
          if (
            ['Liquidity pool (1)', 'Liquidity pool (2)'].indexOf(
              rowValues.service
            ) !== -1
          ) {
            coinQty /= 2
            mainSymbol = coinSymbol
            isLiquidityPool = true
          }
          if (rowValues.currencyPerCoin) {
            currencyPerCoin = rowValues.currencyPerCoin
          } else {
            currencyPerCoin = currencyQty / coinQty
          }
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            isPrice: false,
            direction: 'out',
            isLiquidityPool,
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
            account: accountRecipient,
            contractor: recipient,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty,
          })
        } else if (['Sell'].indexOf(rowValues.operation) !== -1) {
          if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowValues.currencyPerCoin
          }
          if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowValues.currencyPerCoin
          }
          if (
            ['Liquidity pool (1)', 'Liquidity pool (2)'].indexOf(
              rowValues.service
            ) !== -1
          ) {
            coinQty /= 2
            mainSymbol = coinSymbol
            isLiquidityPool = true
          }
          if (!rowValues.currencyPerCoin) {
            currencyPerCoin = currencyQty / coinQty
          } else {
            currencyPerCoin = rowValues.currencyPerCoin
          }
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            isPrice: true,
            isLiquidityPool,
            direction: 'out',
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
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty,
          })
        }
        //* Расчет текущей или исторической цены покупаемого токена
        if (['Buy', 'Sell', 'Refill'].indexOf(rowValues.operation) !== -1) {
          cyrrencyPrice = historicalPrices.getHistoricalPriceBuy(
            rowValues.accountSender,
            project,
            dateTime,
            currencySymbol
          )
          symbolPrice = cyrrencyPrice * currencyPerCoin || void 0
        }
        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          const object = {
            rowKey: tx.rowKey,
            sourceKey: new Hash(this.workSheet.sheetName).md5,
            sourceName: new Hash(this.workSheet.sheetName).stringLowerCase,
            dateTime: dateTime,
            direction: tx.direction.toLowerCase(),
            operation: rowValues.operation.toLowerCase(),
            account: tx.account.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            project: tx.project.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            mainSymbol: tx.mainSymbol ? tx.mainSymbol.toLowerCase() : void 0,
            symbol: tx.symbol.toLowerCase(),
            quantity: tx.quantity,
            price: tx.isPrice ? symbolPrice : void 0,
            comment: rowValues.comment.toLowerCase(),
            registryRowNum: rowValues.rowNum,
            updateDate: updateDate,
            isDelete: rowValues.isDelete,
            isPrice: tx.isPrice,
            isLiquidityPool: tx.isLiquidityPool,
          }
          transactionsArrayOfObject.push(new FormatObject(object).getCopy())
          if (tx.isPrice && !tx.isLiquidityPool) {
            historicalPricesArrayOfObject.push(
              new FormatObject(object).getCopy()
            )
          }
        })
      })

      if (transactionsArrayOfObject.length) {
        new HistoricalPrices().updateHistoricalPrices(
          historicalPricesArrayOfObject,
          this.workSheet.isRange
        )
        new Transactions().updateTransactions(
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
