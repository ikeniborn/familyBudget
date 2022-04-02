import { Registry } from './worksheet/registry'
import { HistoricalPricesAvg } from './worksheet/historicalPricesAvg'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
import { Balance } from './worksheet/balance'
import { Hash, FormatDate } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'
import { LPToken } from './worksheet/lpToken.js'
import { Log } from './worksheet/log'

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
      new HistoricalPricesAvg().updateHistoricalPricesAvg()
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
    new HistoricalPricesAvg().updateHistoricalPricesAvg()
    resolve()
  }).then(() => {
    new Balance().updateBalance()
  })
}

function updateHistoricalPricesAvg() {
  new HistoricalPricesAvg().updateHistoricalPricesAvg()
}

function updateOnEdit(editRange) {
  try {
    const workSheet = new Portfolio().updateOnEdit(editRange.range)
    if (workSheet.isNotNull) {
      if (workSheet.isChangePrimaryKey) {
        workSheet.savePrimaryKeyChanges()
      }
      const startDate = new FormatDate()
      if (new Hash(workSheet.sheetName).md5 === new Hash('prices').md5) {
        SpreadsheetApp.getActive().toast(
          'Start update prices id...',
          'Prices: ',
          1
        )
        new Prices(workSheet).updateId()
        SpreadsheetApp.getActive().toast(
          'Prices id updated!',
          'Save process: ' + startDate.getTimeDiff(),
          3
        )
      } else if (workSheet.sheetName.match(new RegExp('[Registry]+', 'g'))) {
        SpreadsheetApp.getActive().toast(
          'Start update tx...',
          'Transaction: ',
          1
        )
        new Registry(workSheet).updateTransactions()
        SpreadsheetApp.getActive().toast(
          'Tx updated!',
          'Save process: ' + startDate.getTimeDiff(),
          3
        )
      }
    }
  } catch (error) {
    new Log().addError('updateOnEdit', error)
  }
}

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Portfolio')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update transactions', 'updateTransactions')
      .addItem('Update balance', 'updateBalance')
      .addItem('Update prices', 'updatePrices')
      .addItem('Update coins', 'updateCoins')
  )
  menu.addToUi()
}
