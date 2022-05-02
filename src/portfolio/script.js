import { Registry } from './worksheet/registry'
import { Prices } from './worksheet/prices'
import { Coins } from './worksheet/coins'
import { Hash, FormatDate } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'
import { LPToken } from './worksheet/lpToken.js'
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
    new Portfolio().log.addError('updateTransactions', error)
  } finally {
    new Portfolio().log.addMessage(
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
    new Portfolio().log.addError('deleteDuplicatesRows', error)
  } finally {
    new Portfolio().log.addMessage(
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
    new Portfolio().log.addError('updateCoins', error)
  } finally {
    new Portfolio().log.addMessage(
      'updateCoins',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function updateDataMart() {
  const startProcess = new FormatDate()
  new Promise((resolve, reject) => {
    const process = () => {
      new Flow().updateFlow()
      return true
    }
    process() ? resolve() : reject(new Error('script.updateDataMart'))
  })
    .then(
      new Portfolio().log.addMessage(
        'script.updateDataMart',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      new Portfolio().log.addError('script.updateDataMart', error)
    })
}

function updatePrices() {
  const startProcess = new FormatDate()
  new Promise((resolve, reject) => {
    const process = () => {
      new Prices().updatePrices()
      return true
    }
    process() ? resolve() : reject(new Error('script.updatePrices'))
  })
    .then(new Flow().updateFlow())
    .then(
      new Portfolio().log.addMessage(
        'updatePrices',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      new Portfolio().log.addError('script.updatePrices', error)
    })
}

function updateOnEdit(editRange) {
  const startProcess = new FormatDate()

  new Promise((resolve, reject) => {
    const process = () => {
      const workSheet = new Portfolio().updateOnEdit(editRange.range)
      if (workSheet.isChangeData) {
        if (workSheet.isChangePrimaryKey) {
          workSheet.savePrimaryKeyChanges()
        }
        if (workSheet.workSheetKey === new Hash('prices').md5) {
          new Prices(workSheet).updateId()
        } else if (workSheet.isRegistry) {
          new Registry(workSheet).updateTransactions(true)
        }
        workSheet.isResolve = true
      }
      workSheet.isResolve = true
      return workSheet
    }
    const data = process()
    data.isResolve ? resolve(data) : reject(new Error('script.updateOnEdit'))
  })
    .then((workSheet) => {
      if (workSheet.isChangeData) {
        new Portfolio().log.addMessage(
          'script.updateOnEdit',
          'ID:' + startProcess.value,
          'Sheet name: ' +
            workSheet.sheetName +
            ', Start row: ' +
            workSheet.startRow +
            ', End Row: ' +
            workSheet.rowEnd +
            ', Count row: ' +
            workSheet.countRow +
            ', Start: ' +
            startProcess.getFormatDate('YYYY-MM-dd HH:mm:ss') +
            ', Time spent: ' +
            startProcess.getTimeDiff()
        )
      }
    })
    .catch((error) => {
      new Portfolio().log.addError('updateOnEdit', error)
    })

  // new Promise((resolve) => {
  //   let countRunProcess
  //   do {
  //     const runProcess = new GasProcess().getRunningProcesses()
  //     console.log('runProcess', runProcess)
  //     countRunProcess = runProcess?.processes.length || 0
  //     Utilities.sleep(5000)
  //     console.log('Paused')
  //   } while (countRunProcess > 1)
  //   resolve()
  // }).then(updatePromise())
}

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Portfolio')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update data mart', 'updateDataMart')
      .addItem('Update current prices and data mart', 'updatePrices')
  )
  menu.addToUi()
}
