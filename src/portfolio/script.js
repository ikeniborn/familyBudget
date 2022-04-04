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

function updateCoins() {
  new Coins().updateCoins()
}

function updateHistoricalPricesAvg() {
  new HistoricalPricesAvg().updateHistoricalPricesAvg()
}

function updatePrices() {
  const startProcess = new FormatDate()
  try {
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
  } catch (error) {
  } finally {
    new Log().addMessage(
      'updatePrices',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function updateBalance() {
  const startProcess = new FormatDate()
  try {
    new Promise((resolve) => {
      new HistoricalPricesAvg().updateHistoricalPricesAvg()
      resolve()
    }).then(() => {
      new Balance().truncateInsertBalance()
    })
  } catch (error) {
  } finally {
    new Log().addMessage(
      'updateBalance',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function updateOnEdit(editRange) {
  const startProcess = new FormatDate()
  let countRowInRange, shetNameInRange
  try {
    shetNameInRange = editRange.range.getSheet().getName()
    countRowInRange = editRange.range.rowEnd - editRange.range.rowStart + 1
    const workSheet = new Portfolio().updateOnEdit(editRange.range)
    if (workSheet.isNotNull) {
      if (workSheet.isChangePrimaryKey) {
        workSheet.savePrimaryKeyChanges()
      }
      if (new Hash(workSheet.sheetName).md5 === new Hash('prices').md5) {
        new Prices(workSheet).updateId()
      } else if (workSheet.sheetName.match(new RegExp('[Registry]+', 'g'))) {
        new Registry(workSheet).updateTransactions()
      }
    }
  } catch (error) {
    new Log().addError('updateOnEdit', error)
  } finally {
    new Log().addMessage(
      'updateOnEdit',
      'ID:' + startProcess.value,
      'Sheet name: ' +
        shetNameInRange +
        ', Count row: ' +
        countRowInRange +
        ', Time spent: ' +
        startProcess.getTimeDiff()
    )
  }
}

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Portfolio')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update average historical price and balance', 'updateBalance')
      .addItem('Update current prices and balance', 'updatePrices')
      .addItem('Update average historical price', 'updateHistoricalPricesAvg')
      .addItem('Update coins', 'updateCoins')
      .addItem('Update transactions (only admin)', 'updateTransactions')
  )
  menu.addToUi()
}
