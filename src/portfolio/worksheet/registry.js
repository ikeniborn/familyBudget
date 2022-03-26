import { Portfolio } from '../spreadsheet/portfolio'
import { Prices } from './prices'
export { Registry }

class Registry {
  constructor(range) {
    this.workSheet = new Portfolio().getWorkSheet('Registry', range, 1)
    this.values = this.workSheet.getTransactions()
    this.transactions = []
  }

  getTransactions() {
    const prices = new Prices()
    this.values.array.forEach((rowValues, indexTx) => {
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
}
