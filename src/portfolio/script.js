import { Registry } from './worksheet/registry'
import { HistoricalPrices } from './worksheet/historicalPrices'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
import { Balance } from './worksheet/balance'
import { Hash } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'

function updateTransactions() {
  new Registry().updateTransactions()
}

function updatePrices() {
  new Prices().updatePrices()
}

function updateCoins() {
  new Coins().updateCoins()
}

function updateBalance() {
  new Promise((resolve) => {
    new HistoricalPrices().updateHistoricalPrices()
    resolve()
  }).then(() => {
    new Balance().updateBalance()
  })
}

function updateOnEdit(editRange) {
  try {
    const workSheet = new Portfolio().updateOnEdit(editRange.range)
    if (workSheet.isChangePrimaryKey) {
      workSheet.savePrimaryKeyChanges()
    } else if (workSheet.isNotNull) {
      const startDate = new FormatDate(startDate)
      const ui = SpreadsheetApp.getUi() // Same variations.
      const result = ui.alert('Data update', 'Save?', ui.ButtonSet.YES_NO)
      if (result == ui.Button.YES) {
        if (new Hash(workSheet.sheetName).md5 === new Hash('prices').md5) {
          new Prices(workSheet).updateId()
        } else if (workSheet.sheetName.match(new RegExp('[Registry]+', 'g'))) {
          new Registry(workSheet).updateTransactions()
        }
      }
      SpreadsheetApp.getActive().toast(
        'Save time: ' + startDate.getTimeDiff(),
        'Save process: ',
        3
      )
    }
  } catch (error) {
    SpreadsheetApp.getActive().toast('Error: ' + error, 'Save process: ', 3)
  }
}

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Portfolio')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update balance', 'updateBalance')
      .addItem('Update prices', 'updatePrices')
      .addItem('Update coins', 'updateCoins')
  )
  menu.addToUi()
}
