import { WorkSheet } from '../../gas'
import { Hash, FormatDate } from '../../utils'
import { Portfolio } from '../spreadsheet/portfolio'
import { Contractors } from './contractors'
import { Header } from '../../header'
import { Registry } from './registry'
import * as cryptoCompare from '../../restApi/cryptoCompare'
const cryptoCompareInstance = new cryptoCompare.Instance(
  '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125'
)
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
    const currentFormatDate = new FormatDate()
    const contractors = new Contractors().values
    arrayOfObject.forEach((rowValues) => {
      const transactionRow = []
      const accountRecipient = rowValues.accountRecipient
        ? rowValues.accountRecipient
        : rowValues.accountSender
      const recipient = rowValues.recipient
        ? rowValues.recipient
        : rowValues.sender
      const senderType =
        contractors[new Hash(rowValues.sender).md5]?.type || 'none'
      const recipientType = contractors[new Hash(recipient).md5]?.type || 'none'
      if (rowValues.date) {
        if (
          ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !==
          -1
        ) {
          // const currentCoinKey = new Hash(
          //   currentFormatDate.yyyymmdd + rowValues.coin + 'USD'
          // )
          // const historicalCoinkey = new Hash(
          //   historicalFormatDate.yyyymmdd + rowValues.coin + 'USD'
          // )
          const outPrice = 1
          // historicalCoinPrice[historicalCoinkey.md5]?.price ||
          // this.getPrevHistoricalPrice(
          //   historicalCoinPrice,
          //   rowValues.date,
          //   rowValues.coin
          // ) ||
          // historicalCoinPrice[currentCoinKey.md5]?.price
          if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              account: rowValues.accountSender,
              contractor: rowValues.sender,
              type: senderType,
              coin: rowValues.coin,
              pair: rowValues.coin,
              currencyPerCoin: 1,
              quantity: rowValues.coinQty * -1,
              price: outPrice,
              cost: outPrice * rowValues.coinQty * -1,
            })
          }
          if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              account: accountRecipient,
              contractor: recipient,
              type: recipientType,
              coin: rowValues.coin,
              pair: rowValues.coin,
              currencyPerCoin: 1,
              quantity: rowValues.coinQty,
              price: outPrice,
              cost: outPrice * rowValues.coinQty,
            })
          }
        } else if (['Buy'].indexOf(rowValues.operation) !== -1) {
          let coinQty = rowValues.coinQty
          let currencyQty = rowValues.currencyQty
          if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowValues.currencyPerCoin
          }
          if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowValues.currencyPerCoin
          }
          if (rowValues.service === 'Liquidity pool') {
            coinQty /= 2
          }
          // const currentCoinKey = new Hash(
          //   currentFormatDate.yyyymmdd + rowValues.currency + 'USD'
          // )
          // const historicalCoinkey = new Hash(
          //   historicalFormatDate.yyyymmdd + rowValues.currency + 'USD'
          // )
          const outPrice = 1
          // historicalCoinPrice[historicalCoinkey.md5]?.price ||
          // this.getPrevHistoricalPrice(
          //   historicalCoinPrice,
          //   rowValues.date,
          //   rowValues.currency
          // ) ||
          // historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            type: senderType,
            coin: rowValues.currency,
            pair: rowValues.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty * -1,
            price: outPrice,
            cost: outPrice * currencyQty * -1,
          })
          const inPrice = (outPrice * currencyQty) / coinQty
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            type: recipientType,
            coin: rowValues.coin,
            pair: rowValues.currency,
            currencyPerCoin: rowValues.currencyPerCoin
              ? rowValues.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty,
            price: inPrice,
            cost: inPrice * coinQty,
          })
        } else if (['Sell'].indexOf(rowValues.operation) !== -1) {
          let coinQty = rowValues.coinQty
          let currencyQty = rowValues.currencyQty
          if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowValues.currencyPerCoin
          }
          if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowValues.currencyPerCoin
          }
          if (rowValues.service === 'Liquidity pool') {
            coinQty /= 2
          }
          // const currentCoinKey = new Hash(
          //   currentFormatDate.yyyymmdd + rowValues.coin + 'USD'
          // )
          // const historicalCoinkey = new Hash(
          //   historicalFormatDate.yyyymmdd + rowValues.coin + 'USD'
          // )
          const outPrice = 1
          // historicalCoinPrice[historicalCoinkey.md5]?.price ||
          // this.getPrevHistoricalPrice(
          //   historicalCoinPrice,
          //   rowValues.date,
          //   rowValues.coin
          // ) ||
          // historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            type: senderType,
            coin: rowValues.coin,
            pair: rowValues.currency,
            currencyPerCoin: rowValues.currencyPerCoin
              ? rowValues.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty * -1,
            price: outPrice,
            cost: outPrice * coinQty * -1,
          })
          const inPrice = (outPrice * coinQty) / currencyQty
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            type: recipientType,
            coin: rowValues.currency,
            pair: rowValues.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty,
            price: inPrice,
            cost: inPrice * currencyQty,
          })
        }
      }
      // const oldRow = Object.values(this.values).filter(
      //   (row) => row.actionKey === rowValues.rowKey
      // )
      // console.log(oldRow)
      transactionRow.forEach((tx) => {
        this.transactions.push({
          date: rowValues.date,
          account: tx.account,
          platform: rowValues.platform,
          service: rowValues.service,
          contractor: tx.contractor,
          type: tx.type,
          coin: tx.coin,
          pair: tx.pair,
          currencyPerCoin: tx.currencyPerCoin,
          price: tx.price,
          quantity: tx.quantity,
          cost: tx.cost,
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
        rowNum = oldRow.rowNum
        delete this.values[oldRow.rowKey]
        this.workSheet.updateRow(row, this.head, oldRow.rowNum)
      } else {
        rowNum = this.workSheet.lastRow + 1
        console.log(rowNum)
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
    new Transactions()
      .getTransactions(registryOnEdit)
      .updateInsertTransactions()
  }

  getPrevHistoricalPrice(historicalPrices, date, coin) {
    const prevHistoricalPrice = Object.entries(historicalPrices)
      .filter(([rowKey, row]) => {
        return new Hash(row.symbol).md5 === new Hash(coin).md5
      })
      .reduce((lastPrice, [rowKey, row]) => {
        if (
          new FormatDate(row.date).yyyymmdd <= new FormatDate(date).yyyymmdd &&
          row.price
        ) {
          lastPrice = row.price
        }
        return lastPrice
      }, 0)
    console.log(date, coin, prevHistoricalPrice)
    return prevHistoricalPrice ? prevHistoricalPrice : void 0
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
