import { Registry } from './worksheet/registry'
import { Transactions } from './worksheet/transactions'

function updateTransactions() {
  const arrayOfObject = new Registry().getRegistry()
  new Transactions().getTransactions(arrayOfObject).truncateInsertTrasactions()
}

function updateTransactionsOnEdit(editRange) {
  const registryOnEdit = new Registry().getRegistryOnEdit(editRange.range)

  new Transactions().getTransactions(registryOnEdit).updateInsertTransactions()
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
