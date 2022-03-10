function updateCoinsPrice() {
  portfolioLib.updateCoinsPrice()
}

function updateCoinsList() {
  portfolioLib.updateCoinLsist()
}

function updateTransactions() {
  portfolioLib.updateTransactions()
}

function updateDaily() {
  portfolioLib.updateCoinsPrice()
  SpreadsheetApp.flush()
  portfolioLib.updateTransactions()
}

function updateUsdPerCurrency(editRange) {
  portfolioLib.updateUsdPerCurrency(editRange)
}

function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Library')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update daily', 'updateDaily')
      .addItem('Update price', 'updateCoinPrice')
      .addItem('Update transaction', 'updateTransaction')
      .addItem('Update coin list', 'updateCoinList')
  )
  menu.addToUi()
}
