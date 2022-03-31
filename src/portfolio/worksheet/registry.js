import { Hash } from '../../utils'
import { Portfolio } from '../spreadsheet/portfolio'
import { FormatDate, FormatNumber } from '../../utils'
import { Prices } from './prices'
export { Registry }

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName())
  }

  updateTransactions() {
    try {
      const arrayOfObject = []
      const updateDate = new Date()
      const prices = new Prices()
      this.workSheet.arrayOfObject.forEach((rowValues) => {
        let coinQty,
          currencyQty,
          currencyPerCoin,
          coinSymbol,
          coinPrice,
          project,
          accountRecipient,
          recipient,
          currencySymbol,
          cyrrencyPrice
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
        if (
          ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !==
          -1
        ) {
          if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#1').md5,
              isPrice: false,
              account: rowValues.accountSender,
              contractor: rowValues.sender,
              project: 'No project',
              coin: coinSymbol,
              quantity: coinQty * -1,
            })
          }
          if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#2').md5,
              isPrice: false,
              account: accountRecipient,
              contractor: recipient,
              project: 'No project',
              coin: coinSymbol,
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
          if (rowValues.service === 'Liquidity pool') {
            coinQty /= 2
          }
          if (rowValues.currencyPerCoin) {
            currencyPerCoin = rowValues.currencyPerCoin
          } else {
            currencyPerCoin = currencyQty / coinQty
          }
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            isPrice: false,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            coin: currencySymbol,
            quantity: currencyQty * -1,
          })
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            isPrice: true,
            account: accountRecipient,
            contractor: recipient,
            project: project,
            coin: coinSymbol,
            quantity: coinQty,
          })
        } else if (['Sell'].indexOf(rowValues.operation) !== -1) {
          if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowValues.currencyPerCoin
          }
          if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowValues.currencyPerCoin
          }
          if (rowValues.service === 'Liquidity pool') {
            coinQty /= 2
          }
          if (!rowValues.currencyPerCoin) {
            currencyPerCoin = currencyQty / coinQty
          } else {
            currencyPerCoin = rowValues.currencyPerCoin
          }
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            isPrice: true,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: project,
            coin: coinSymbol,
            quantity: coinQty * -1,
          })
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            isPrice: false,
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            coin: currencySymbol,
            quantity: currencyQty,
          })
        }
        if (currencySymbol && coinSymbol) {
          cyrrencyPrice = prices.getHistoricalPrice(
            rowValues.accountSender,
            project,
            dateTime,
            currencySymbol
          )
          coinPrice = cyrrencyPrice * currencyPerCoin || void 0
        }
        transactionRow.forEach((tx) => {
          arrayOfObject.push({
            rowKey: tx.rowKey,
            dateTime: dateTime,
            account: tx.account.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            project: tx.project.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            coin: tx.coin.toLowerCase(),
            quantity: tx.quantity,
            price: tx.coin === coinSymbol && tx.isPrice ? coinPrice : void 0,
            comment: rowValues.comment.toLowerCase(),
            registryRowNum: rowValues.rowNum,
            updateDate: updateDate,
          })
        })
      })
      const transactions = new Portfolio().getWorkSheet('transactions')
      if (this.workSheet.isRange) {
        arrayOfObject.forEach((tx) => {
          const oldRow = transactions.object[tx.rowKey]
          if (oldRow?.rowKey) {
            tx.rowNum = oldRow.rowNum
            transactions.updateRow(tx)
          } else {
            transactions.insertRow(tx)
          }
        })
      } else {
        transactions.truncateInsertRows(arrayOfObject)
      }
    } catch (error) {
      console.error('Registry.updateTransactions', error)
    }
  }
}
