import { Registry } from './worksheet/registry'
import { Transactions } from './worksheet/transactions'
import { Contractors } from './worksheet/contractors'
import { HistoricalPrices } from './worksheet/historicalPrices'
import { Operations } from './worksheet/operations'
import { Services } from './worksheet/services'
import { Accounts } from './worksheet/accounts'
import { Sources } from './worksheet/sources'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
import { Hash } from '../utils'

function updateTransactions() {
  const arrayOfObject = new Registry().getRegistry()
  new Transactions().getTransactions(arrayOfObject).truncateInsertTrasactions()
}

function updateOnEdit(editRange) {
  const range = editRange.range
  const workSheet = range.getSheet()
  const sheetName = workSheet.getSheetName()
  const sheetKey = new Hash(sheetName).md5
  if (sheetKey === new Hash('Registry').md5) {
    new Transactions().updateTransactionsOnEdit(range)
  } else if (sheetKey === new Hash('Contractors').md5) {
    new Contractors().updateOnEdit(range)
  } else if (sheetKey === new Hash('HistoricalPrices').md5) {
    new HistoricalPrices().updateOnEdit(range)
  } else if (sheetKey === new Hash('Operations').md5) {
    new Operations().updateOnEdit(range)
  } else if (sheetKey === new Hash('Services').md5) {
    new Services().updateOnEdit(range)
  } else if (sheetKey === new Hash('Accounts').md5) {
    new Accounts().updateOnEdit(range)
  } else if (sheetKey === new Hash('Sources').md5) {
    new Sources().updateOnEdit(range)
  } else if (sheetKey === new Hash('Prices').md5) {
    new Prices().updateOnEdit(range)
  } else if (sheetKey === new Hash('Coins').md5) {
    new Coins().updateOnEdit(range)
  }
}

function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Library')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      // .addItem('Update daily', 'updateDaily')
      // .addItem('Update price', 'updateCoinsPrice')
      .addItem('Update transaction', 'updateTransactions')
    // .addItem('Update coin list', 'updateCoinsList')
  )
  menu.addToUi()
}
