function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Crypto')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('CoinGecko')
      .addItem('Update price', 'updatePrice')
  )
  menu.addToUi()
}
