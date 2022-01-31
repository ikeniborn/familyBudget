function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Library')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Price')
      .addItem('Update', 'updatePrice')
  )
  menu.addToUi()
}
