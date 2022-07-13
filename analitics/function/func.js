function loadUpdatePairForm() {
  const htmlForSidebar = HtmlService.createTemplateFromFile('html/updatePair')
  const htmlOutput = htmlForSidebar.evaluate()
  htmlOutput.setTitle('Overflow')
  const ui = SpreadsheetApp.getUi()
  ui.showSidebar(htmlOutput)
}

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Analitics')
  menu.addItem('Update data', 'loadUpdatePairForm')
  menu.addToUi()
}

function showToast(msg, title) {
  SpreadsheetApp.getActive().toast(msg, title, 3)
}

function showAlertUpdate() {
  showAlert('Update complete')
}

function showAlertUpdateError() {
  showAlert('Update not complete. Repeat update')
}

function showAlertCalculate() {
  showAlert('Calculate complete')
}

function afterEndUpdateAndCalculate() {
  showAlert('Update and calculate complete')
}
