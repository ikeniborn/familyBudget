import { Hash, FormatDate, FormatNumber } from '../../utils'
import { Portfolio } from '../spreadsheet/portfolio'
export { Transactions }

class Transactions {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Registry')
  }

  getTransactions(arrayOfObject = []) {
    this.transactions = []
    const prices = new Prices()
    arrayOfObject.forEach((rowValues, indexTx) => {
      // const startDate = new FormatDate()
      let coinQty,
        currencyQty,
        currencyPerCoin,
        coinSymbol,
        coinPrice,
        project,
        accountRecipient,
        recipient,
        currencySymbol
      const transactionRow = []
      const hhmm = new FormatNumber(rowValues.time).getHourAndMinuteFromNumber()
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
        ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !== -1
      ) {
        if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            dateTime: dateTime,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            coin: coinSymbol,
            quantity: coinQty * -1,
          })
        }
        if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
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
          account: rowValues.accountSender,
          contractor: rowValues.sender,
          project: 'No project',
          coin: currencySymbol,
          quantity: currencyQty * -1,
        })
        transactionRow.push({
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
          account: rowValues.accountSender,
          contractor: rowValues.sender,
          project: project,
          coin: coinSymbol,
          quantity: coinQty * -1,
        })
        transactionRow.push({
          account: accountRecipient,
          contractor: recipient,
          project: 'No project',
          coin: currencySymbol,
          quantity: currencyQty,
        })
      }
      if (currencySymbol && coinSymbol) {
        coinPrice =
          prices.getHistoricalPrice(
            rowValues.accountSender,
            project,
            dateTime,
            currencySymbol
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
          actionRowNum: rowValues.rowNum,
        })
      })
      // console.log('Time for ' + indexTx + ': ' + startDate.getTimeDiff())
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
    const arrayofObject = this.getTransactions().map((row, index) => {
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
