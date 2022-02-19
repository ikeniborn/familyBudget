function updateCoinPrice() {
  portfolioLib.updateCoinPrice();
}

function updateCoinList() {
  portfolioLib.updateCoinList();
}

function updateDataSet() {
  portfolioLib.updateDataSet();
}

function updateDaily() {
  portfolioLib.updateCoinPrice();
  SpreadsheetApp.flush();
  portfolioLib.updateDataSet();
}

function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Library');
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update daily', 'updateDaily')
      .addItem('Update price', 'updateCoinPrice')
      .addItem('Update coin list', 'updateCoinList')
      .addItem('Update data set', 'updateDataSet')
  );
  menu.addToUi();
}
