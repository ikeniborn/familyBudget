import { WorkSheet } from '../../gas'
import { Hash, FormatDate, FormatNumber } from '../../utils'
import { Portfolio } from '../spreadsheet/portfolio'
import { Contractors } from './contractors'
import { Header } from '../../header'
import { Registry } from './registry'
import { Prices } from './prices'
// import { HistoricalPrices } from './historicalPrices'
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
    const contractors = new Contractors().values
    arrayOfObject.forEach((rowValues) => {
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
      let coinQty, currencyQty, currencyPerCoin, coin, coinPrice
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
        coin = rowValues.coin
        if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
          currencyQty = coinQty * rowValues.currencyPerCoin
        }
        if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
          coinQty = currencyQty / rowValues.currencyPerCoin
        }
        if (rowValues.service === 'Liquidity pool') {
          coinQty /= 2
        }
        ;(currencyPerCoin = rowValues.currencyPerCoin
          ? rowValues.currencyPerCoin
          : currencyQty / coinQty),
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
        coin = rowValues.coin
        if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
          currencyQty = coinQty * rowValues.currencyPerCoin
        }
        if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
          coinQty = currencyQty / rowValues.currencyPerCoin
        }
        if (rowValues.service === 'Liquidity pool') {
          coinQty /= 2
        }
        ;(currencyPerCoin = currencyQty / coinQty),
          transactionRow.push({
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            type: senderType,
            coin: rowValues.coin,
            pair: rowValues.currency,
            quantity: coinQty * -1,
          })
        transactionRow.push({
          account: accountRecipient,
          contractor: recipient,
          type: recipientType,
          coin: rowValues.currency,
          pair: rowValues.coin,
          quantity: currencyQty,
        })
      }
      if (rowValues.currency && coin) {
        coinPrice =
          new Prices().getPrice(dateTime, rowValues.currency) * currencyPerCoin
        // new HistoricalPrices().updateHistoricalPrice(dateTime, coin, coinPrice)
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
          price: tx.quantity > 0 && coinPrice ? coinPrice : void 0,
          comment: rowValues.comment,
          actionKey: rowValues.rowKey,
        })
      })
    })

    // const arrayOfObject = transaction.map((row, index) => {
    //   const rowNum = index + 1
    //   const rowKey = new Hash(rowNum + 'transactions').md5
    //   row.rowKey = rowKey
    //   return row
    // })

    // const historicalCoinPriceArray = Object.values(historicalCoinPrice)
    //   .map((m) => (m = Object.values(m)))
    //   .sort((a, b) => {
    //     return (
    //       new Date(a[this.head.historicalPrice.date.idx]).valueOf() -
    //       new Date(b[this.head.historicalPrice.date.idx]).valueOf()
    //     )
    //   })

    // const lastCoinPrice = historicalCoinPriceArray.reduce((target, source) => {
    //   const row = {
    //     date: new FormatDate(
    //       source[this.head.historicalPrice.date.idx]
    //     ).getFormatDate('yyyy-MM-dd'),
    //     coinKey: new Hash(source[this.head.historicalPrice.symbol.idx])
    //       .md5,
    //     price: source[this.head.historicalPrice.price.idx],
    //   }
    //   if (!target[row.coinKey]) {
    //     target[row.coinKey] = { date: row.date, price: row.price }
    //   }
    //   if (
    //     new Date(target[row.coinKey].date).valueOf() <
    //       new Date(row.date).valueOf() &&
    //     row.price
    //   ) {
    //     target[row.coinKey] = { date: row.date, price: row.price }
    //   }
    //   return target
    // }, {})
    // this.updateCustomPrice(lastCoinPrice)
    // this.updateBalance(transaction, lastCoinPrice, historicalCoinPrice)
    // this.workSheet.portfolio.historicalPrice.insertValues(
    // historicalCoinPriceArray,
    // this.head.getHeaderAlias(this.head.historicalPrice)
    // )

    // this.workSheet.insertValues(arrayOfObject, this.head)
    return this
  }

  updateInsertTransactions() {
    // console.log(transactions)
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
    // console.log(rows)
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

  updateCustomPrice(lastHistoricalPrice = { date: '', price: 0 }) {
    const updatedCustomPrice = this.workSheet.portfolio.price.dataValues.map(
      (row) => {
        const lastCoinData =
          lastHistoricalPrice[new Hash(row[this.head.price.symbol.idx]).md5]
        if (
          (!row[this.head.price.price.idx] ||
            new Date(row[this.head.price.lastUpdated.idx]).valueOf() <
              new Date(lastCoinData.date).valueOf()) &&
          !row[this.head.price.source.idx]
        ) {
          row[this.head.price.price.idx] = lastCoinData?.price || 0
          row[this.head.price.lastUpdated.idx] =
            lastCoinData?.date || new Date()
        }
        return row
      }
    )
    this.workSheet.portfolio.price.insertValues(
      updatedCustomPrice,
      this.head.getHeaderAlias(this.head.price)
    )
  }

  updateBalance(
    transaction = [],
    lastCoinPrice = {},
    historicalCoinPrice = {}
  ) {
    const aggregationValues = transaction.reduce((target, source) => {
      const row = {
        date: new FormatDate(
          source[this.head.transaction.date.idx]
        ).getFormatDate('yyyy-MM-dd'),
        account: source[this.head.transaction.account.idx].toUpperCase(),
        contractors: source[
          this.head.transaction.contractors.idx
        ].toUpperCase(),
        type: source[this.head.transaction.type.idx].toUpperCase(),
        coin: source[this.head.transaction.coin.idx],
        quantity: source[this.head.transaction.quantity.idx],
      }

      if (!target['balance']) {
        target['balance'] = {}
      }
      if (!target['balance'][row.date]) {
        target['balance'][row.date] = {}
      }
      if (!target['balance'][row.date][row.account]) {
        target['balance'][row.date][row.account] = {}
      }
      if (!target['balance'][row.date][row.account][row.contractors]) {
        target['balance'][row.date][row.account][row.contractors] = {}
      }
      if (
        !target['balance'][row.date][row.account][row.contractors][row.type]
      ) {
        target['balance'][row.date][row.account][row.contractors][row.type] = {}
      }
      if (
        !target['balance'][row.date][row.account][row.contractors][row.type][
          row.coin
        ]
      ) {
        target['balance'][row.date][row.account][row.contractors][row.type][
          row.coin
        ] = 0
      }
      target['balance'][row.date][row.account][row.contractors][row.type][
        row.coin
      ] += row.quantity

      if (!target['allocation']) {
        target['allocation'] = {}
      }
      if (!target['allocation'][row.account]) {
        target['allocation'][row.account] = {}
      }
      if (!target['allocation'][row.account][row.type]) {
        target['allocation'][row.account][row.type] = {}
      }
      if (!target['allocation'][row.account][row.type][row.coin]) {
        target['allocation'][row.account][row.type][row.coin] = 0
      }
      target['allocation'][row.account][row.type][row.coin] += row.quantity

      return target
    }, {})

    const balance = []
    Object.entries(aggregationValues.balance).forEach(([date, level0]) => {
      const yyyymmdd = new FormatDate(date).yyyymmdd
      Object.entries(level0).forEach(([account, level1]) => {
        Object.entries(level1).forEach(([contractors, level2]) => {
          Object.entries(level2).forEach(([type, level3]) => {
            Object.entries(level3).forEach(([coin, quantity]) => {
              const currentPrice = lastCoinPrice[new Hash(coin).md5]?.price
              const historicalPrice =
                historicalCoinPrice[new Hash(yyyymmdd + coin + 'usd').md5]
                  ?.price
              const currentCost = quantity * currentPrice
              const historicalCost = quantity * historicalPrice
              balance.push([
                date,
                account,
                contractors,
                type,
                coin.toUpperCase(),
                quantity,
                historicalCost,
                currentCost,
              ])
            })
          })
        })
      })
    })

    const allocation = []
    Object.entries(aggregationValues.allocation).forEach(([account, type]) => {
      Object.entries(type).forEach(([type, coin]) => {
        Object.entries(coin).forEach(([coin, quantity]) => {
          const currentPrice = lastCoinPrice[new Hash(coin).md5]?.price
          const currentCost = quantity * currentPrice
          allocation.push([
            account,
            type,
            coin.toUpperCase(),
            quantity,
            currentCost,
          ])
        })
      })
    })

    this.workSheet.portfolio.balance.insertValues(
      balance,
      this.head.getHeaderAlias(this.head.balance)
    )
    this.workSheet.portfolio.allocation.insertValues(
      allocation,
      this.head.getHeaderAlias(this.head.allocation)
    )
  }
}
