import * as gas from '../gas'
import { Registry } from './worksheet/registry'
import { Contractors } from './worksheet/contractors'
import { Coins } from './worksheet/coins'
import { HistoricalPrice } from './worksheet/historicalPrice'
import { Transactions } from './worksheet/transactions'
// function updateCoinsPrice() {
//   new Coins().updateCoinsPrice()
// }

// function updateCoinsList() {
//   new Coins().updateCoinsList()
// }

function updateTransactions() {
  new Transactions().updateTransactions()
}

function updateUsdPerCurrency(editRange) {
  console.log(new Registry().getFact())
}

// function createInvoiceMenu() {
//   const ui = SpreadsheetApp.getUi()
//   const menu = ui.createMenu('Library')
//   menu.addSubMenu(
//     SpreadsheetApp.getUi()
//       .createMenu('Update')
//       .addItem('Update daily', 'updateDaily')
//       .addItem('Update price', 'updateCoinsPrice')
//       .addItem('Update transaction', 'updateTransactions')
//       .addItem('Update coin list', 'updateCoinsList')
//   )
//   menu.addToUi()
// }
