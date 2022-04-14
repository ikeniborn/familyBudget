import { Registry } from './worksheet/registry'
// import { HistoricalPrices } from './worksheet/historicalPrices'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
import { Hash, FormatDate } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'
import { LPToken } from './worksheet/lpToken.js'
import { Log } from './worksheet/log'
import { FlowSymbol } from './worksheet/flowSymbol'
import { Flow } from './worksheet/flow'
import { Transactions } from './worksheet/transactions'
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

function deleteDuplicatesRows() {
  const startProcess = new FormatDate()
  try {
    new Transactions().deleteDuplicatesRows()
  } catch (error) {
    new Log().addError('deleteDuplicatesRows', error)
  } finally {
    new Log().addMessage(
      'deleteDuplicatesRows',
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
    new FlowSymbol().updateFlow()
    // new Flow().updateFlow()
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

function updatePrices() {
  const startProcess = new FormatDate()
  try {
    new Promise((resolve) => {
      new Prices().updatePrices()
      resolve()
    }).then(() => {
      new FlowSymbol().updateFlow()
      // new Flow().updateFlow()
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

function updateOnEdit(editRange) {
  const startProcess = new FormatDate()
  let countRowInRange,
    sheetNameInRange,
    rowStartInRange,
    rowEndInRange,
    isRegistry
  isRegistry = false
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
          new Promise((resolve) => {
            SpreadsheetApp.getActive().toast(
              'Save registry starting',
              'Save process',
              1
            )
            resolve()
          }).then(() => {
            new Registry(workSheet).updateTransactions(true)
            isRegistry = true
          })
        }
      }
      return true
    }
    update() ? resolve(isRegistry) : reject()
  })
    .then((isRegistry) => {
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
      if (isRegistry) {
        SpreadsheetApp.getActive().toast(
          'Save process ended',
          'Save process',
          1
        )
      }
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
      .addItem('Update coins', 'updateCoins')
      .addItem('Update transactions', 'updateTransactions')
      .addItem('Update flow', 'updateFlow')
  )
  menu.addToUi()
}
