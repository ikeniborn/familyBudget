import { WorkSheet } from '../../gas'
import { Hash, FormatDate, FormatNumber } from '../../utils'
import { Portfolio } from '../spreadsheet/portfolio'
import { Contractors } from './contractors'
import { Header } from '../../header'
import { Registry } from './registry'
import { Prices } from './prices'
import { HistoricalPrices } from './historicalPrices'
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
    const historicalPrices = new HistoricalPrices().values
    const contractors = new Contractors().values
    console.log(contractors)
    arrayOfObject.forEach((rowValues, indexTx) => {
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
      const senderType =
        contractors[new Hash(rowValues.sender).md5]?.type || 'none'
      const recipientType = contractors[new Hash(recipient).md5]?.type || 'none'
      let coinQty, currencyQty, currencyPerCoin, coinSymbol, coinPrice
      if (
        ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !== -1
      ) {
        if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            dateTime: dateTime,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            type: senderType,
            coin: rowValues.coin,
            quantity: rowValues.coinQty * -1,
          })
        }
        if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            type: recipientType,
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
          type: senderType,
          coin: rowValues.currency,
          quantity: currencyQty * -1,
        })
        transactionRow.push({
          account: accountRecipient,
          contractor: recipient,
          type: recipientType,
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
          type: senderType,
          coin: rowValues.coin,
          quantity: coinQty * -1,
        })
        transactionRow.push({
          account: accountRecipient,
          contractor: recipient,
          type: recipientType,
          coin: rowValues.currency,
          quantity: currencyQty,
        })
      }
      if (rowValues.currency && coinSymbol) {
        coinPrice =
          prices.getPrice(dateTime, rowValues.currency) * currencyPerCoin
      }
      transactionRow.forEach((tx) => {
        this.transactions.push({
          dateTime: dateTime,
          account: tx.account,
          platform: rowValues.platform,
          service: rowValues.service,
          project: rowValues.project,
          contractor: tx.contractor,
          type: tx.type,
          coin: tx.coin,
          quantity: tx.quantity,
          price:
            tx.coin === coinSymbol
              ? coinPrice
                ? coinPrice
                : historicalPrices[new Hash(tx.account + coinSymbol)]?.price
              : void 0,
          comment: rowValues.comment,
          actionKey: rowValues.rowKey,
        })
      })
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
