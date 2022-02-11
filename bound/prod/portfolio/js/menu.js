function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Library')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update price', 'updateCoinPrice')
      .addItem('Update coin list', 'updateCoinList')
      .addItem('Update data set', 'updateDataSet')
  )
  menu.addToUi()
}
