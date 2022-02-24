function updateCoinPrice() {
  portfolioLib.updateCoinPrice();
}

function updateCoinList() {
  portfolioLib.updateCoinList();
}

function updateTransaction() {
  portfolioLib.updateTransaction();
}

function updateHistoricalPriceKey() {
  portfolioLib.updateHistoricalPriceKey();
}

function updateDaily() {
  portfolioLib.updateCoinPrice();
  SpreadsheetApp.flush();
  portfolioLib.updateTransaction();
}

function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Library');
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update daily', 'updateDaily')
      .addItem('Update price', 'updateCoinPrice')
      .addItem('Update transaction', 'updateTransaction')
      .addItem('Update coin list', 'updateCoinList')
  );
  menu.addToUi();
}
