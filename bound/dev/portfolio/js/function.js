function updateCoinPrice() {
  familyBudgetLib.updateCoinPrice()
}

function updateCoinList() {
  familyBudgetLib.updateCoinList()
}

function updateDataSet() {
  familyBudgetLib.updateDataSet()
}

function updateDaily() {
  familyBudgetLib.updateCoinPrice()
  SpreadsheetApp.flush()
  familyBudgetLib.updateDataSet()
}
