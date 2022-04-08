import { Registry } from './worksheet/registry'
import { HistoricalPricesAvg } from './worksheet/historicalPricesAvg'
// import { HistoricalPrices } from './worksheet/historicalPrices'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
import { Balance } from './worksheet/balance'
import { Hash, FormatDate } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'
import { LPToken } from './worksheet/lpToken.js'
import { Log } from './worksheet/log'
import { Flow } from './worksheet/flow'
// import { GasProcess } from '../restApi/gasScriptApi'

function updateLPToken() {
  new LPToken().updateLPToken()
}

function updateTransactions() {
  const startProcess = new FormatDate()
  try {
    new Registry().updateTransactions()
  } catch (error) {
    new Log().addError('updateTransactions', error)
  } finally {
    new Log().addMessage(
      'updateTransactions',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function updateCoins() {
  const startProcess = new FormatDate()
  try {
    new Coins().updateCoins()
  } catch (error) {
    new Log().addError('updateCoins', error)
  } finally {
    new Log().addMessage(
      'updateCoins',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function updateFlow() {
  const startProcess = new FormatDate()
  try {
    new Flow().updateFlow()
  } catch (error) {
    new Log().addError('updateFlow', error)
  } finally {
    new Log().addMessage(
      'updateFlow',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function updateHistoricalPricesAvg() {
  const startProcess = new FormatDate()
  try {
    new HistoricalPricesAvg().updateHistoricalPricesAvg()
  } catch (error) {
    new Log().addError('updateHistoricalPricesAvg', error)
  } finally {
    new Log().addMessage(
      'updateHistoricalPricesAvg',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function updatePrices() {
  const startProcess = new FormatDate()
  try {
    new Promise((resolve) => {
      new Prices().updatePrices()
      resolve()
    }).then(() => {
      new Flow().updateFlow()
      // new Promise((resolve) => {
      //   new HistoricalPricesAvg().updateHistoricalPricesAvg()
      //   resolve()
      // }).then(() => {
      //   new Balance().truncateInsertBalance()
      // })
    })
  } catch (error) {
    new Log().addError('updatePrices', error)
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
  let countRowInRange, sheetNameInRange, rowStartInRange, rowEndInRange
  sheetNameInRange = editRange.range.getSheet().getName()
  countRowInRange = editRange.range.rowEnd - editRange.range.rowStart + 1
  countColumnInRange =
    editRange.range.columnEnd - editRange.range.columnStart + 1
  rowStartInRange = editRange.range.rowStart
  rowEndInRange = editRange.range.rowEnd
  new Promise((resolve, reject) => {
    const update = () => {
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
      return true
    }
    update() ? resolve() : reject()
  })
    .then(() => {
      new Log().addMessage(
        'updateOnEdit',
        'ID:' + startProcess.value,
        'Sheet name: ' +
          sheetNameInRange +
          ', Start row: ' +
          rowStartInRange +
          ', End Row: ' +
          rowEndInRange +
          ', Count row: ' +
          countRowInRange +
          ', Time spent: ' +
          startProcess.getTimeDiff()
      )
    })
    .catch((error) => {
      new Log().addError('updateOnEdit', error)
    })
}

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Portfolio')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      // .addItem('Update average historical price and balance', 'updateBalance')
      .addItem('Update current prices and flow', 'updatePrices')
      // .addItem('Update average historical price', 'updateHistoricalPricesAvg')
      .addItem('Update coins', 'updateCoins')
      .addItem('Update transactions', 'updateTransactions')
      .addItem('Update flow', 'updateFlow')
  )
  menu.addToUi()
}
