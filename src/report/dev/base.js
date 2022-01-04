function updateAccountData() {
  FamilyBudgetData.updateAccountData()
}

function onOpen() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet()
  var menuEntries = [{
    name: 'Обновление данных',
    functionName: 'updateAccountData'
  }]
  sheet.addMenu('Обновление', menuEntries)
}