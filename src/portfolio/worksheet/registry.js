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
      const transactionArrayOfObject = []
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
          cyrrencyPrice,
          mainCoin
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
          currencyPerCoin = 1
          currencySymbol = coinSymbol
          if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#1').md5,
              isPrice: false,
              direction: 'out',
              account: rowValues.accountSender,
              contractor: rowValues.sender,
              project: 'No project',
              mainCoin: void 0,
              coin: coinSymbol,
              quantity: coinQty * -1,
            })
          }
          if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#2').md5,
              isPrice: true,
              direction: 'in',
              account: accountRecipient,
              contractor: recipient,
              project: 'No project',
              mainCoin: void 0,
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
          if (
            ['Liquidity pool (1)', 'Liquidity pool (2)'].indexOf(
              rowValues.service
            ) !== -1
          ) {
            coinQty /= 2
            mainCoin = coinSymbol
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
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainCoin: mainCoin,
            coin: currencySymbol,
            quantity: currencyQty * -1,
          })
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            isPrice: true,
            direction: 'in',
            account: accountRecipient,
            contractor: recipient,
            project: project,
            mainCoin: mainCoin,
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
          if (
            ['Liquidity pool (1)', 'Liquidity pool (2)'].indexOf(
              rowValues.service
            ) !== -1
          ) {
            coinQty /= 2
            mainCoin = coinSymbol
          }
          if (!rowValues.currencyPerCoin) {
            currencyPerCoin = currencyQty / coinQty
          } else {
            currencyPerCoin = rowValues.currencyPerCoin
          }
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            isPrice: true,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: project,
            mainCoin: mainCoin,
            coin: coinSymbol,
            quantity: coinQty * -1,
          })
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            isPrice: false,
            direction: 'in',
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            mainCoin: mainCoin,
            coin: currencySymbol,
            quantity: currencyQty,
          })
        }
        if (['Buy', 'Sell', 'Refill'].indexOf(rowValues.operation) !== -1) {
          cyrrencyPrice = prices.getHistoricalPrice(
            rowValues.accountSender,
            project,
            dateTime,
            currencySymbol
          )
          coinPrice = cyrrencyPrice * currencyPerCoin || void 0
        }

        transactionRow.forEach((tx) => {
          transactionArrayOfObject.push({
            rowKey: tx.rowKey,
            dateTime: dateTime,
            direction: tx.direction.toLowerCase(),
            operation: rowValues.operation.toLowerCase(),
            account: tx.account.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            project: tx.project.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            mainCoin: tx.mainCoin ? tx.mainCoin.toLowerCase() : void 0,
            coin: tx.coin.toLowerCase(),
            quantity: tx.quantity,
            price: tx.isPrice ? coinPrice : void 0,
            comment: rowValues.comment.toLowerCase(),
            registryRowNum: rowValues.rowNum,
            updateDate: updateDate,
            isDelete: rowValues.isDelete,
          })
        })
      })
      const transactions = new Portfolio().getWorkSheet('transactions')
      if (this.workSheet.isRange) {
        const deleteArray = []
        transactionArrayOfObject.forEach((tx) => {
          const oldRow = transactions.object[tx.rowKey]
          if (oldRow?.rowKey) {
            tx.rowNum = oldRow.rowNum
            if (tx.delete) {
              deleteArray.push(tx)
            } else {
              transactions.updateRow(tx)
            }
          } else {
            transactions.insertRow(tx)
          }
        })
      } else {
        transactions.truncateInsertRows(transactionArrayOfObject)
      }
    } catch (error) {
      console.error('Registry.updateTransactions', error)
    }
  }
}
