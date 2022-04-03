import { Registry } from './worksheet/registry'
import { HistoricalPricesAvg } from './worksheet/historicalPricesAvg'
import { HistoricalPrices } from './worksheet/historicalPrices'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
import { Balance } from './worksheet/balance'
import { Hash, FormatDate } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'
import { LPToken } from './worksheet/lpToken.js'
import { Log } from './worksheet/log'
import { GasProcess } from '../restApi/gasScriptApi'

function updateLPToken() {
  new LPToken().updateLPToken()
}

function updateTransactions() {
  new Registry().updateTransactions()
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
      new Balance().truncateInsertBalance()
    })
  })
}

function updateCoins() {
  new Coins().updateCoins()
}

function updateHistoricalPricesAvg() {
  new HistoricalPricesAvg().updateHistoricalPricesAvg()
}

function updateBalance() {
  new Promise((resolve) => {
    new HistoricalPricesAvg().updateHistoricalPricesAvg()
    resolve()
  }).then(() => {
    new Balance().truncateInsertBalance()
  })
}

function updateOnEdit(editRange) {
  const startProcess = new FormatDate()
  try {
    new Log().addMessage(
      'updateOnEdit',
      'Start update ' + editRange.range.getSheet().getName(),
      startProcess.value +
        ': count row - ' +
        (editRange.range.rowEnd - editRange.range.rowStart + 1)
    )
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
  } finally {
    new Log().addMessage(
      'updateOnEdit',
      'End update ' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
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
      .addItem('Update average historical price', 'updateHistoricalPricesAvg')
      .addItem('Update coins', 'updateCoins')
      .addItem('Update transactions (only admin)', 'updateTransactions')
  )
  menu.addToUi()
}
