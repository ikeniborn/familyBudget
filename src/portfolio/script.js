import { Registry } from './worksheet/registry'
import { HistoricalPrices } from './worksheet/historicalPrices'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
import { Balance } from './worksheet/balance'
import { Hash, FormatDate } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'
import { LPToken } from './worksheet/lpToken.js'

function updateTransactions() {
  new Registry().updateTransactions()
}

function updateLPToken() {
  new LPToken().updateLPToken()
}

function updatePrices() {
  new Promise((resolve) => {
    new Prices().updatePrices()
    resolve()
  }).then(() => {
    new Promise((resolve) => {
      new HistoricalPrices().updateHistoricalPrices()
      resolve()
    }).then(() => {
      new Balance().updateBalance()
    })
  })
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
      if (new Hash(workSheet.sheetName).md5 === new Hash('prices').md5) {
        new Prices(workSheet).updateId()
      } else if (workSheet.sheetName.match(new RegExp('[Registry]+', 'g'))) {
        SpreadsheetApp.getActive().toast(
          'Start update tx...',
          'Transaction: ',
          1
        )
        const startDate = new FormatDate()
        // const ui = SpreadsheetApp.getUi() // Same variations.
        // const result = ui.alert('Data update', 'Save?', ui.ButtonSet.YES_NO)
        // if (result == ui.Button.YES) {
        new Registry(workSheet).updateTransactions()
        SpreadsheetApp.getActive().toast(
          'Tx updated!',
          'Save process: ' + startDate.getTimeDiff(),
          3
        )
        // }
      }
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
