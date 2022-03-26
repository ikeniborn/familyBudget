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
import { Project } from './worksheet/project'
import { Balance } from './worksheet/balance'
import { Hash } from '../utils'

function test() {
  console.log(new Registry().values.array)
}
function test2(editRange) {
  console.log(new Registry(editRange.range).getTransactions().transactions)
}

function updateTransactions() {
  const arrayOfObject = new Registry().getRegistry()
  new Transactions().getTransactions(arrayOfObject).truncateInsertTrasactions()
}

function updatePrices() {
  new Prices().updatePrices()
}

function updateHistoricalPrices() {
  new HistoricalPrices().updateHistoricalPrices()
}

function updateCoins() {
  new Coins().updateCoins()
}

function updateBalance() {
  new Balance().updateBalance()
}

function updateOnEdit(editRange) {
  const range = editRange.range
  const workSheet = range.getSheet()
  const sheetName = workSheet.getSheetName()
  const sheetKey = new Hash(sheetName).md5
  if (sheetKey === new Hash('Registry').md5) {
    // new Transactions(range).updateTransactionsOnEdit(range)
  } else if (sheetKey === new Hash('Contractors').md5) {
    new Contractors(range).savePrimaryKeyChanges()
  } else if (sheetKey === new Hash('HistoricalPrices').md5) {
    new HistoricalPrices(range)
  } else if (sheetKey === new Hash('Operations').md5) {
    new Operations(range).savePrimaryKeyChanges()
  } else if (sheetKey === new Hash('Services').md5) {
    new Services(range).savePrimaryKeyChanges()
  } else if (sheetKey === new Hash('Accounts').md5) {
    new Accounts(range).savePrimaryKeyChanges()
  } else if (sheetKey === new Hash('Sources').md5) {
    new Sources(range).savePrimaryKeyChanges()
  } else if (sheetKey === new Hash('Prices').md5) {
    new Prices(range).saveChanges()
  } else if (sheetKey === new Hash('Coins').md5) {
    new Coins(range).saveChanges()
  } else if (sheetKey === new Hash('Project').md5) {
    new Project(range).savePrimaryKeyChanges()
  }
}

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Library')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update transactions', 'updateTransactions')
      .addItem('Update historical prices', 'updateHistoricalPrices')
      .addItem('Update balance', 'updateBalance')
      .addItem('Update prices', 'updatePrices')
      .addItem('Update coins', 'updateCoins')
  )
  menu.addToUi()
}
