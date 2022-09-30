import { Registry } from './worksheet/registry'
import { Symbols } from './worksheet/symbols'
import { Coins } from './worksheet/coins'
import { Hash, FormatDate, FormatNumber } from '../utils'
import { Portfolio } from './spreadsheet/portfolio'
import { LPToken } from './worksheet/lpToken.js'
import { Flow } from './worksheet/flow'
import { Transactions } from './worksheet/transactions'
import { WorkSheetMetadata, ModalDialog, SpreadsheetsTrigger } from '../gas'
import { Web3Space } from './worksheet/web3space'
import { Overflows } from './worksheet/overflows'
import * as coinMarketCap from '../restApi/coinMarketCap'
import { GasProcess } from '../restApi/gasScriptApi'

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Portfolio')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Service')
      .addItem('Update prices', 'updatePrices')
      .addItem('Update flow', 'updateFlow')
      .addItem('Update flow balance', 'updateFlowBalance')
      .addItem('Update overflows', 'updateOverflows')
      .addItem('Update coins', 'updateCoins')
      .addItem('Validate transactions', 'validateTransactions')
  )
  menu.addItem('Sort registry', 'sortRegistry')
  menu.addToUi()
}

function cleanAllMetadata() {
  const activeWorkSheet = SpreadsheetApp.getActiveSheet()
  console.log('activeWorkSheet: ', activeWorkSheet.getName())
  new WorkSheetMetadata(activeWorkSheet).metadata.deleteAllMetadata()
}

function getCategory() {
  new Web3Space().getCategory()
}

function getCategories() {
  console.log(new coinMarketCap.Category().getCategories())
}

function updateLPToken() {
  new LPToken().updateLPToken()
}

function updateTransactions() {
  const startProcess = new FormatDate()
  try {
    new Registry().updateTransactions()
  } catch (error) {
    console.error('script.updateTransactions', error.stack)
  } finally {
    new Portfolio().log.addMessage(
      'updateTransactions',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function validateTransactions() {
  const startProcess = new FormatDate()
  new Promise((resolve, reject) => {
    const process = () => {
      new Registry().validateTransactions()
      return true
    }
    process() ? resolve() : reject(new Error('script.validateTransactions'))
  })
    .then(
      new Portfolio().log.addMessage(
        'script.validateTransactions',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.validateTransactions', error.stack)
    })
}

function updateCoins() {
  const startProcess = new FormatDate()
  try {
    new Coins().updateCoins()
  } catch (error) {
    console.error('script.updateCoins', error.stack)
  } finally {
    new Portfolio().log.addMessage(
      'script.updateCoins',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    )
  }
}

function updatePrices() {
  const startProcess = new FormatDate()
  new Promise((resolve, reject) => {
    const process = () => {
      new Symbols().updatePrices()
      return true
    }
    process() ? resolve() : reject(new Error('script.updatePrices'))
  })
    .then(
      new Portfolio().log.addMessage(
        'script.updatePrices',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updatePrices', error.stack)
    })
}

function updateFlow() {
  const startProcess = new FormatDate()
  new Promise((resolve, reject) => {
    const process = () => {
      new Flow().updateFlow()
      return true
    }
    process() ? resolve() : reject(new Error('script.updateFlow'))
  })
    .then(
      new Portfolio().log.addMessage(
        'updateFlow',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updateFlow', error.stack)
    })
}

function updateFlowBalance() {
  const startProcess = new FormatDate()
  new Promise((resolve, reject) => {
    const process = () => {
      new Flow().updateFlowBalance()
      return true
    }
    process() ? resolve() : reject(new Error('script.updateFlowBalance'))
  })
    .then(
      new Portfolio().log.addMessage(
        'updateFlowBalance',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updateFlowBalance', error.stack)
    })
}

function updateOverflows() {
  const startProcess = new FormatDate()
  new Promise((resolve, reject) => {
    const process = () => {
      new Overflows().updateOverflows()
      return true
    }
    process() ? resolve() : reject(new Error('script.updateOverflows'))
  })
    .then(
      new Portfolio().log.addMessage(
        'script.updateOverflows',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updateOverflows', error.stack)
    })
}

function deleteDisabledTrigger() {
  new SpreadsheetsTrigger().deleteDisabledTrigger()
}

function updatePortfolio() {
  new SpreadsheetsTrigger().createForSpreadsheetArter('updatePrices', 1)
  new SpreadsheetsTrigger().createForSpreadsheetArter('updateFlow', 300)
  new SpreadsheetsTrigger().createForSpreadsheetArter('updateFlowBalance', 600)
  new SpreadsheetsTrigger().createForSpreadsheetArter('updateOverflows', 900)
  new SpreadsheetsTrigger().createForSpreadsheetArter(
    'deleteDisabledTrigger',
    930
  )
}

function updateRegistryRowKey() {
  new Transactions().updateRegistryRowKey()
}

function updateRowKey() {
  new Transactions().updateRowKey()
}

function updateIsOverflow() {
  new Transactions().updateIsOverflow()
}

function updatePair() {
  new Transactions().updatePair()
}

function updatePriceCostBTC(startIndex, endIndex) {
  new Transactions().updatePriceCostBTC(startIndex, endIndex)
}

function updateHistoricalAveragePriceKey() {
  new Transactions().updateHistoricalAveragePriceKey()
}

function updateAccount() {
  new Transactions().updateAccount()
}

function updateOnEdit(editRange) {
  try {
    const startProcess = new FormatDate()
    const lock = LockService.getScriptLock()
    const savingDialog = new ModalDialog('html/SavingProcess', 300, 100)
    let startDialog = false
    if (editRange.range.rowEnd - editRange.range.rowStart > 0) {
      startDialog = true
    }
    new Promise((resolve, reject) => {
      const workSheet = new Portfolio().updateOnEdit(editRange.range)
      if (workSheet.isChangeData) {
        const startLock = new FormatDate()
        lock.tryLock(180000)
        if (startDialog) {
          savingDialog.showModalDialog('Saving process')
          startDialog = true
        } else {
          SpreadsheetApp.getActive().toast('Start saving...', 'Process', 1)
        }
        workSheet.lockTime = startLock.getTimeDiff()
        if (workSheet.isChangePrimaryKey) {
          workSheet.savePrimaryKeyChanges()
        }
        if (workSheet.workSheetKey === new Hash('symbols').md5) {
          new Symbols(workSheet).updateId()
        } else if (workSheet.isRegistry) {
          new Promise((resolve) => {
            const registry = new Registry(workSheet)
            registry.deleteDateSaved()
            resolve(registry)
          }).then((registry) => {
            registry.updateTransactions(true)
          })
        }
        resolve(workSheet)
      } else {
        reject(workSheet)
      }
    })
      .then((workSheet) => {
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
            startProcess.getTimeDiff() +
            ', Lock time: ' +
            workSheet?.lockTime || 0
        )
        lock.releaseLock()
        if (startDialog) {
          savingDialog.closeModalDialog('All row saved!', 200)
        }
      })
      .catch((workSheet) => {
        // if (startDialog) {
        //   savingDialog.closeModalDialog('All row saved!', 200)
        // } else {
        //   SpreadsheetApp.getActive().toast('End saving...', 'Process', 1)
        // }
        console.error('script.updateOnEdit', workSheet.sheetName)
        lock.releaseLock()
      })
  } catch (error) {
    console.error('script.updateOnEdit', error.stack)
  }

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

function sortRegistry() {
  const activeSheet = SpreadsheetApp.getActiveSheet()
  //* обработка фильтрации
  const filter = {}
  filter.customFilter = activeSheet.getFilter()
  if (filter.customFilter) {
    filter.isExist = true
    for (let i = 1; i <= this.maxColumn; i++) {
      const criteria = filter.customFilter.getColumnFilterCriteria(i)
      if (criteria !== null) {
        filter.columnPosition = i
        filter.filterCriteria = criteria.copy()
        break
      }
    }
    if (filter.columnPosition) {
      filter.customFilter.remove()
    }
  }
  //* сортировка регистра
  const activeWorkSheet = new Portfolio().getWorkSheet(activeSheet.getName())
  if (activeWorkSheet.isRegistry) {
    const registry = new Registry(activeWorkSheet)
    registry.filter = filter
    const newArrayOfObject = registry.workSheet.arrayOfObject
      .filter((row) => {
        return row.rowKey
      })
      .map((row) => {
        const time = row.time || 2359
        const date = row.date || new Date()
        const hhmm = new FormatNumber(time).getHourAndMinuteFromNumber()
        const DateTime = new FormatDate(date).addTime(hhmm.h, hhmm.m).date
        row.dateTime = DateTime
        return row
      })
      .sort((a, b) => {
        return ('' + a.coin).localeCompare(b.coin)
      })
      .sort((a, b) => {
        return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
      })
    registry.workSheet.truncateInsertRows(newArrayOfObject)
  }
}
