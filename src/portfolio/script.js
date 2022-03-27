// import { Registry } from './worksheet/registry'
// import { Transactions } from './worksheet/transactions'
// import { Contractors } from './worksheet/contractors'
import { HistoricalPrices } from './worksheet/historicalPrices'
// import { Operations } from './worksheet/operations'
// import { Services } from './worksheet/services'
// import { Accounts } from './worksheet/accounts'
// import { Sources } from './worksheet/sources'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
// import { Project } from './worksheet/project'
import { Balance } from './worksheet/balance'
import { Hash } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'

function updateTransactions() {
  console.log(new Portfolio().getDataset('contractors').object)
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
  const workSheet = new Portfolio().updateOnEdit(editRange.range)
  if (workSheet.isChangePrimaryKey) {
    workSheet.savePrimaryKeyChanges()
  }
  if (workSheet.isNotNull) {
    if (new Hash(workSheet.sheetName).md5 === new Hash('prices').md5) {
      new Prices(workSheet).updateId()
    }
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
