import { WorkSheet } from '../../gas'
import { Hash, FormatDate, FormatNumber } from '../../utils'
import { Portfolio } from '../spreadsheet/portfolio'
import { Header } from '../../header'
import { Registry } from './registry'
import { Prices } from './prices'
export { Transactions }

class Transactions {
  constructor() {
    this.head = new Portfolio().head.transactions
    this.header = new Header()
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.workSheet = new WorkSheet(this.spreadSheetName, 'transactions')
    this.values = this.workSheet.getFact(this.head)
  }

  getTransactions(arrayOfObject = []) {
    this.transactions = []
    const prices = new Prices()
    arrayOfObject.forEach((rowValues, indexTx) => {
      const startDate = new FormatDate()
      let coinQty, currencyQty, currencyPerCoin, coinSymbol, coinPrice, project
      const transactionRow = []
      const hhmm = new FormatNumber(rowValues.time).getHourAndMinuteFromNumber()
      const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
        .date
      const accountRecipient = rowValues.accountRecipient
        ? rowValues.accountRecipient
        : rowValues.accountSender
      const recipient = rowValues.recipient
        ? rowValues.recipient
        : rowValues.sender

      project = rowValues.project ? rowValues.project : 'No project'
      if (
        ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !== -1
      ) {
        if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            dateTime: dateTime,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            coin: rowValues.coin,
            quantity: rowValues.coinQty * -1,
          })
        }
        if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            coin: rowValues.coin,
            quantity: rowValues.coinQty,
          })
        }
      } else if (['Buy'].indexOf(rowValues.operation) !== -1) {
        coinQty = rowValues.coinQty
        currencyQty = rowValues.currencyQty
        coinSymbol = rowValues.coin
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
          account: rowValues.accountSender,
          contractor: rowValues.sender,
          project: 'No project',
          coin: rowValues.currency,
          quantity: currencyQty * -1,
        })
        transactionRow.push({
          account: accountRecipient,
          contractor: recipient,
          project: project,
          coin: rowValues.coin,
          quantity: coinQty,
        })
      } else if (['Sell'].indexOf(rowValues.operation) !== -1) {
        coinQty = rowValues.coinQty
        currencyQty = rowValues.currencyQty
        coinSymbol = rowValues.coin
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
          account: rowValues.accountSender,
          contractor: rowValues.sender,
          project: project,
          coin: rowValues.coin,
          quantity: coinQty * -1,
        })
        transactionRow.push({
          account: accountRecipient,
          contractor: recipient,
          project: 'No project',
          coin: rowValues.currency,
          quantity: currencyQty,
        })
      }
      if (rowValues.currency && coinSymbol) {
        coinPrice =
          prices.getHistoricalPrice(
            rowValues.accountSender,
            dateTime,
            rowValues.currency
          ) * currencyPerCoin || void 0
      }
      transactionRow.forEach((tx) => {
        this.transactions.push({
          dateTime: dateTime,
          account: tx.account.toLowerCase(),
          platform: rowValues.platform.toLowerCase(),
          service: rowValues.service.toLowerCase(),
          project: tx.project.toLowerCase(),
          contractor: tx.contractor.toLowerCase(),
          coin: tx.coin.toLowerCase(),
          quantity: tx.quantity,
          price: tx.coin === coinSymbol ? coinPrice : void 0,
          comment: rowValues.comment.toLowerCase(),
          actionKey: rowValues.rowKey,
        })
      })
      console.log('Time for ' + indexTx + ': ' + startDate.getTimeDiff())
    })
    return this
  }

  updateInsertTransactions() {
    this.transactions.forEach((row) => {
      const oldRow = Object.values(this.values).filter(
        (oldRow) => oldRow.actionKey === row.actionKey
      )[0]
      let rowNum
      if (oldRow) {
        row.rowKey = oldRow.rowKey
        row.rowNum = oldRow.rowNum
        delete this.values[oldRow.rowKey]
        this.workSheet.updateRow(row, this.head)
      } else {
        rowNum = this.workSheet.lastRow + 1
        row.rowKey = new Hash(rowNum + this.workSheet.sheetName).md5
        this.workSheet.insertRow(row, this.head)
      }
    })
  }

  truncateInsertTrasactions() {
    let rowNum
    const rows = this.transactions.map((row, index) => {
      rowNum = index + 1
      row.rowKey = new Hash(rowNum + this.workSheet.sheetName).md5
      return row
    })
    this.workSheet.insertRows(rows, this.head)
  }

  updateTransactionsOnEdit(range) {
    const registryOnEdit = new Registry().getRegistryOnEdit(range)
    if (registryOnEdit.length) {
      new Transactions()
        .getTransactions(registryOnEdit)
        .updateInsertTransactions()
    }
  }
}
