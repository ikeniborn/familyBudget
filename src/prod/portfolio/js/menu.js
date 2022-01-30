function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Library')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Price')
      .addItem('Update CoinGecko', 'updateCoinGecko')
      .addItem('Update Cryptorank', 'updateCryptorank')
      .addItem('Update fiat', 'updateFiat')
  )
  menu.addToUi()
}
