import { Hash } from './utils'
import { Header } from './header'

export {
  Environment,
  SpreadSheet,
  WorkSheet,
  SpreadsheetsTrigger,
  WorkSheetMetadata,
  WorkSheetRange,
}

class Environment {
  constructor(
    environment = [
      {
        spreadSheetName: '',
        sheetId: '',
        scriptId: '',
        area: '',
      },
    ]
  ) {
    if (Environment.exists) {
      return Environment.instance
    }
    Environment.instance = this
    Environment.exists = true
    this.getEnvironment(environment)
  }

  getEnvironment(environment) {
    const scriptId = ScriptApp.getScriptId()
    const currentArea = environment.reduce((area, row) => {
      if (row.scriptId === scriptId) {
        area = row.area
      }
      return area
    }, '')
    if (currentArea) {
      environment.forEach((row) => {
        if (row.area === currentArea) {
          const spreadSheet = SpreadsheetApp.openById(row.sheetId)
          const spreadSheetName = row.spreadSheetName.toLowerCase()
          if (!this[spreadSheetName]) {
            this[spreadSheetName] = {}
          }
          this[spreadSheetName].spreadSheet = spreadSheet
        }
      })
    } else {
      console.error('Check environment!!!')
    }
  }
}

class SpreadSheet {
  constructor(spreadSheetName = '', excludeSheetName = []) {
    spreadSheetName = spreadSheetName.toString().toLowerCase()
    if (SpreadSheet.spreadSheetName === spreadSheetName) {
      return SpreadSheet.instance
    }
    SpreadSheet.instance = this
    const instance = new Environment()[spreadSheetName]
    this.spreadSheetName = spreadSheetName
    this.spreadSheet = instance.spreadSheet
    this.excludeSheetName = excludeSheetName.map((m) => new Hash(m).md5)
    this.workSheets = this.spreadSheet
      .getSheets()
      .reduce((workSheets, workSheet) => {
        const key = new Hash(workSheet.getName()).md5
        if (!workSheets[key] && this.excludeSheetName.indexOf(key) === -1) {
          workSheets[key] = workSheet
        }
        return workSheets
      }, {})
  }
}

class WorkSheet extends SpreadSheet {
  /**
   *
   * @param {*} spreadSheetName
   * @param {*} sheetName
   * @param {*} head
   * @param {*} headerRowNum
   * @returns
   */
  constructor(spreadSheetName = '', sheetName = '', head = {}) {
    super(spreadSheetName)
    if (WorkSheet.key === new Hash(sheetName).md5) {
      return WorkSheet.instance
    }
    WorkSheet.instance = this
    this.workSheetKey = new Hash(sheetName).md5
    this.sheetName = sheetName
    this.headType = head.type
    this.head = head.columns
    this.headKey = Object.keys(this.head)
    this.headRowNum = head.rowNum
    this.firstRowNum = this.headRowNum + 1
    this.workSheet = this.workSheets[this.workSheetKey]
    this.range = this.workSheet.getDataRange()
    this.countRow = this.range.getNumRows() - this.headRowNum
    this.countColumn = this.range.getNumColumns()
    this.isRange = false
    this.dataRange =
      this.countRow > 0
        ? this.workSheet
            .getDataRange()
            .offset(this.headRowNum, 0, this.countRow, this.countColumn)
        : this.workSheet
            .getDataRange()
            .offset(this.headRowNum - 1, 0, 1, this.countColumn)
    // this.metadata = new WorkSheetMetadata(this.workSheet)
    this.getDataset()
  }

  get lastRow() {
    return this.workSheet.getLastRow()
  }

  get maxRow() {
    return this.workSheet.getMaxRows()
  }

  get lastColumn() {
    return this.workSheet.getLastColumn()
  }

  get maxColumn() {
    return this.workSheet.getMaxColumns()
  }

  getFact() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow
        const rowKey = arrayRow[this.head.rowKey.idx]
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = arrayRow.reduce((object, value, index) => {
            object['rowNum'] = rowNum
            if (!object[this.headKey[index]]) {
              object[this.headKey[index]] = value
            }
            return object
          }, {})
        }
        return objectRow
      }, {})
    this.arrayOfObject = Object.values(this.object)
    return this
  }

  getDimension() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow
        const rowKey = arrayRow[this.head.rowKey.idx]
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = arrayRow.reduce((object, value, index) => {
            if (!object[this.headKey[index]]) {
              object[this.headKey[index]] = value
            }
            object['rowNum'] = rowNum
            return object
          }, {})
        }
        return objectRow
      }, {})
    this.arrayOfObject = Object.values(this.object)
    return this
  }

  getTransactions() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow
        const rowKey = new Hash(rowNum + this.sheetName).md5
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = arrayRow.reduce((object, value, column) => {
            object['rowKey'] = rowKey
            object['rowNum'] = rowNum
            if (!object[this.headKey[column]]) {
              object[this.headKey[column]] = value
            }
            return object
          }, {})
        }
        return objectRow
      }, {})
    this.arrayOfObject = Object.values(this.object)
    return this
  }

  truncateInsertRows(arrayOfObject = [], firstRow = 1, firstColumn = 1) {
    const array = arrayOfObject.reduce(
      (values, rowObject) => {
        const rowArray = this.headKey.map((value) => rowObject[value])
        values.push(rowArray)
        return values
      },
      [new Header().getHeaderAlias(this.head)]
    )
    console.log(this.headKey)
    console.log(this.sheetName)
    console.log(array)
    if (array.length) {
      const truncateInsertRowsPromise = () => {
        return new Promise((resolve) => {
          this.deleteFilter()
          resolve()
        }).then(() => {
          return new Promise((resolve) => {
            this.workSheet
              .clear()
              .getRange(firstRow, firstColumn, array.length, array[0].length)
              .setValues(array)
            resolve()
          }).then(() => {
            this.deleteEmptyRows().deleteEmptyColumns()
          })
        })
      }

      truncateInsertRowsPromise()
    }
    return this
  }

  updateRow(object = {}) {
    if (object.rowNum !== this.headerRowNum) {
      const array = [this.headKey.map((column) => object[column])]
      const updateRowPromise = async () => {
        return new Promise((resolve) => {
          this.deleteFilter()
          resolve()
        }).then(async () => {
          return new Promise((resolve) => {
            this.workSheet
              .getRange(object.rowNum, 1, array.length, array[0].length)
              .setValues(array)
            resolve()
          }).then(() => {
            this.deleteEmptyRows().deleteEmptyColumns()
          })
        })
      }
      updateRowPromise()
    }
  }

  insertRow(object = {}) {
    new Promise((resolve) => {
      const array = this.headKey.map((column) => object[column])
      this.workSheet.appendRow(array)
      resolve()
    }).then(() => {
      this.deleteEmptyRows().deleteEmptyColumns()
    })
  }

  insertValue(value, row, column) {
    this.workSheet.getRange(row, column).setValue(value)
  }

  deleteFilter() {
    this.customFilter = this.workSheet.getFilter()
    if (this.customFilter) {
      this.customFilter.remove()
    }
    return this
  }

  /**
   *  Удаление пустых строк
   */
  deleteEmptyRows() {
    const countEmptyRow = this.maxRow - this.lastRow
    const firstEmptyRow = this.lastRow + 1
    if (countEmptyRow) {
      this.workSheet.deleteRows(firstEmptyRow, countEmptyRow)
    }
    return this
  }

  /**
   *  Удаление пустых колонок
   */
  deleteEmptyColumns() {
    const countEmptyRow = this.maxColumn - this.lastColumn
    const firstEmptyRow = this.lastColumn + 1
    if (countEmptyRow) {
      this.workSheet.deleteColumns(firstEmptyRow, countEmptyRow)
    }
    return this
  }

  getDataset() {
    if (this.headType === 'dim') {
      this.getDimension()
    } else if (this.headType === 'fct') {
      this.getFact()
    } else if (this.headType === 'tx') {
      this.getTransactions()
    }
    return this
  }
}

class WorkSheetRange extends WorkSheet {
  constructor(spreadSheetName, sheetName, head, range) {
    super(spreadSheetName, sheetName, head)
    this.range = range
    this.countRow = this.range.rowEnd - this.range.rowStart + 1
    this.countColumn = this.range.columnEnd - this.range.columnStart + 1
    this.firstRowNum = this.range.rowStart
    this.isChangePrimaryKey = false
    this.isNotNull = false
    this.isRange = true
    this.dataRange = range.offset(
      0,
      1 - this.range.columnStart,
      this.countRow,
      this.maxColumn
    )
    this.rowNumArray = [...Array(this.countRow).keys()].map(
      (m) => (m = m + this.range.rowStart)
    )
    this.columnNumArray = [...Array(this.countColumn).keys()].map(
      (m) => (m = m + this.range.columnStart)
    )
    this.getDataset()
  }

  getFact() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow
        const rowKey = arrayRow[this.head.rowKey.idx]
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = arrayRow.reduce((object, value, index) => {
            object['rowNum'] = rowNum
            if (!object[this.headKey[index]]) {
              object[this.headKey[index]] = value
            }
            return object
          }, {})
        }
        return objectRow
      }, {})
    this.arrayOfObject = Object.values(this.object)
    return this
  }

  getDimension() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow
        const object = arrayRow.reduce((object, value, index) => {
          if (!object[this.headKey[index]]) {
            object[this.headKey[index]] = value
          }
          object['rowNum'] = rowNum
          return object
        }, {})
        const newRowKey = new Header().getPrimaryKey(this.head, object)
        object.isChangePrimaryKey = false
        if (object.rowKey !== newRowKey) {
          object.rowKey = newRowKey
          // object.isChangePrimaryKey = true
          this.isChangePrimaryKey = true
        }
        if (!objectRow[object.rowKey]) {
          objectRow[object.rowKey] = object
        }
        // object.isNotNull = new Header().isNotNull(this.head, object)
        this.isNotNull = new Header().isNotNull(this.head, object)
        return objectRow
      }, {})
    this.arrayOfObject = Object.values(this.object)
    return this
  }

  getTransactions() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow
        const rowKey = new Hash(rowNum + this.sheetName).md5
        const object = arrayRow.reduce((object, value, column) => {
          if (!object[this.headKey[column]]) {
            object[this.headKey[column]] = value
            object['rowKey'] = rowKey
            object['rowNum'] = rowNum
          }
          return object
        }, {})
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = object
          objectRow[rowKey]['rowKey'] = rowKey
          objectRow[rowKey]['rowNum'] = rowNum
          this.isNotNull = new Header().isNotNull(this.head, object)
        }
        return objectRow
      }, {})
    this.arrayOfObject = Object.values(this.object)
    return this
  }

  savePrimaryKeyChanges() {
    if (this.firstRowNum !== this.headRowNum) {
      this.arrayOfObject.forEach((object) => {
        this.updateRow(object)
      })
    }
  }
}

class GoogleCache {
  /**
   * Работа с кэшем Google
   * @param {integer} seconds Время хранения кэша в секундах
   */
  constructor(seconds = 60) {
    this.seconds = seconds
    this.cache = CacheService.getScriptCache()
  }

  /**
   * Добавление в кэш по ключу. Данные приводятся к строке
   * @param {object} object - Данные в формате {key:value}
   * @param data - строка
   */
  addCache(object) {
    const key = Object.keys(object)[0]
    const data = JSON.stringify(object[key])
    this.cache.put(key, data, this.seconds)
  }

  /**
   *
   * @param {object} object Данные в формате {key:value}
   */
  addAllCache(object) {
    this.cache.putAll(object, this.seconds)
  }

  /**
   *
   * @param {string} key
   * @returns
   */
  getCache(key) {
    return JSON.parse(this.cache.get(key)) || void 0
  }

  /**
   *
   * @param {array} keys Массив ключей
   * @returns
   */
  getAllCache(keys) {
    return this.cache.getAll(keys)
  }

  /**
   *
   * @param {string} key
   */
  removeCache(key) {
    this.cache.remove(key)
  }

  /**
   *
   * @param {array} keys
   */
  removeAllCache(keys) {
    this.cache.removeAll(keys)
  }
}

class GasScript {
  constructor(parametr) {
    this.parametr = parametr + ': '
    this.startDate = new Date()
  }
  getLastProjectVersion() {
    const url =
      'https://script.googleapis.com/v1/projects/' + scriptId + '/versions'

    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    })
    return Math.max(JSON.parse(res).versions.map((m) => (m = m.versionNumber)))
  }
  error(value) {
    console.error(this.parametr, value)
  }
  info(value) {
    console.info(this.parametr, value)
  }
  timeExecution() {
    const time = new FormatDate(this.startDate).getTimeDiff()
    console.info(this.parametr, time)
    return time
  }
  flush() {
    SpreadsheetApp.flush()
  }
}

class FileDB {
  constructor(fileName) {
    this.fileName = fileName
    this.dApp = DriveApp
  }
  createFile(data) {
    return DriveApp.createFile(this.fileName, JSON.stringify(data))
  }
  getDataFromFile() {
    const file = DriveApp.getFilesByName(this.fileName).next()

    const info = file.getAs('application/octet-stream').getDataAsString()
    return JSON.parse(info)
  }
}
class Metadata {
  /**
   * Методы работы с метаданными листа книги
   * @param {object} target объект метаданных: принимает книгу, лист, диапазон
   */
  constructor(target) {
    this.target = target
    this.metadata = target.getDeveloperMetadata().reduce((keys, metadata) => {
      keys[metadata.getKey()] = {
        remove: () => metadata.remove(),
        getKey: () => metadata.getKey(),
        getValue: () => metadata.getValue(),
        setValue: (value) => metadata.setValue(value),
        value: metadata.getValue(),
      }
      return keys
    }, {})
    this.metaMap = new Map(Object.entries(this.metadata))
  }
  /**
   * Добавление значения в метаданные листа
   * @param {string} key ключ метаданых
   * @param {string} value значение ключа
   */
  addMetadata(key, value) {
    const newValue = value
    if (this.metaMap.has(key)) {
      const oldValue = this.metadata[key].getValue()
      if (new Hash(newValue).md5 !== new Hash(oldValue).md5) {
        this.metadata[key].setValue(newValue)
        this.metadata[key].value = newValue
      }
    } else {
      this.metadata = this.target
        .addDeveloperMetadata(key, newValue)
        .getDeveloperMetadata()
        .reduce((keys, metadata) => {
          keys[metadata.getKey()] = {
            remove: () => metadata.remove(),
            getKey: () => metadata.getKey(),
            getValue: () => metadata.getValue(),
            setValue: (value) => metadata.setValue(value),
          }
          return keys
        }, {})
      this.metaMap = new Map(Object.entries(this.metadata))
    }
  }

  getMetadata(key) {
    if (this.metaMap.has(key)) {
      return this.metadata[key].getValue()
    }
  }

  deleteMetadata(key) {
    key = key.toString()
    if (this.metaMap.has(key)) {
      this.metadata[key].remove()
    }
  }
  deleteAllMetadata() {
    Object.keys(this.metadata).forEach((key) => {
      this.metadata[key].remove()
    })
  }
}

class WorkSheetMetadata extends Metadata {
  /**
   * Работа с метаданными листа
   * @param {object} sheet объект листа
   */
  constructor(sheet) {
    super(sheet)
    this.sheetName = sheet.getName().toUpperCase()
  }
  /**
   * Добавление ключа строки в метаданные
   * @param {number} rowNum номер строки листа
   */
  addRowKey(rowNum, value) {
    const key = 'ROWKEY_' + rowNum
    super.addMetadata(key, value)
    return value
  }
  /**
   * Получение ключа строки с листа
   * @param {number} rowNum номер строки листа
   * @returns строка в формате Hash
   */
  getRowKey(rowNum) {
    const key = 'ROWKEY_' + rowNum
    return super.getMetadata(key)
  }
  /**
   * Добавление ключа листа в метаданные
   * @param {string} sheetKey ключ листа в формате Hash
   */
  addSheetKey() {
    const value = new Hash(this.sheetName).md5
    super.addMetadata('SHEETKEY', value)
    return value
  }
  /**
   * Получение ключа листа из метаданных
   * @returns ключ листа в формате Hash
   */
  getSheetKey() {
    return super.getMetadata('SHEETKEY')
  }
  /**
   * Изменение счетчика изменений
   * @param {boolean} clear признак обнуления счетчика
   */
  updateCountChange(clear = false) {
    const oldValue = new ETL(super.getMetadata('COUNTCHANGE')).toNumber() || 0
    let newValue
    if (clear) {
      newValue = 0
    } else {
      newValue = oldValue + 1
    }
    super.addMetadata('COUNTCHANGE', newValue)
    return newValue
  }
  /**
   * Показ текущего количества изменений листа
   * @returns число изменений
   */
  getCountChange() {
    return new ETL(super.getMetadata('COUNTCHANGE')).toNumber() || 0
  }

  getSheetName() {
    const oldValue = super.getMetadata('SHEETNAME')
    if (oldValue) {
      return oldValue
    } else {
      super.addMetadata('SHEETNAME', this.sheetName)
      return this.sheetName
    }
  }
}

class SpreadSheetMetadata extends Metadata {
  /**
   * Работа с метаданными книги
   * @param {object} spreadsheet объект книга
   */
  constructor(spreadsheet) {
    super(spreadsheet)
  }
  /**
   * Получение договорных условий по клиенту из метаданных
   * @param {string} sheetKey ключ листа
   * @returns объект ключ/значение по условиям
   */
  getTerm(sheetKey) {
    sheetKey = 'TERMKEY_' + sheetKey
    const term = super.getMetadata(sheetKey)
    if (term) {
      return JSON.parse(term)
    }
  }
  /**
   * Добавление новых условий по клиенту
   * @param {string} sheetKey ключ листа в формате Hash
   * @param {object} term договорные условия в формате ключ/значение
   */
  addTerm(sheetKey, term) {
    term = JSON.stringify(term)
    sheetKey = 'TERMKEY_' + sheetKey
    super.addMetadata(sheetKey, term)
  }
}

class Trigger {
  /**
   * Информация по триггерам
   */
  constructor() {
    this.sApp = ScriptApp
  }

  getEventName(eventType) {
    if (eventType == this.sApp.EventType.CLOCK) {
      return 'CLOCK'
    } else if (eventType == this.sApp.EventType.ON_EDIT) {
      return 'ON_EDIT'
    } else if (eventType == this.sApp.EventType.ON_OPEN) {
      return 'ON_OPEN'
    } else {
      return void 0
    }
    return this
  }
  getTriggerSourceName(triggerSource) {
    if (triggerSource == this.sApp.TriggerSource.CLOCK) {
      return 'CLOCK'
    } else if (triggerSource == this.sApp.TriggerSource.SPREADSHEETS) {
      return 'SPREADSHEETS'
    } else {
      return void 0
    }
    return this
  }

  get list() {
    const triggers = this.sApp.getProjectTriggers()
    return triggers.reduce((list, trigger) => {
      list[trigger.getUniqueId()] = {
        triggerId: trigger.getUniqueId(),
        sourceId: trigger.getTriggerSourceId(),
        handlerFunction: trigger.getHandlerFunction(),
        eventType: this.getEventName(trigger.getEventType()),
        triggerSource: this.getTriggerSourceName(trigger.getTriggerSource()),
      }
      return list
    }, {})
    return this
  }
}

class SpreadsheetsTrigger extends Trigger {
  /**
   * Создание триггера для таблиц Google
   * @param {object} ss объект книги
   */
  constructor(ss) {
    super()
    this.ss = ss
    this.instance = this
  }

  /**
   * Создание триггера при открытии
   * @param {string} functionName Название функции
   */
  createForSpreadsheetOnOpen(functionName) {
    this.sApp.newTrigger(functionName).forSpreadsheet(this.ss).onOpen().create()
    return this
  }
  /**
   * Создание триггера при редактировании электронной таблицы
   * @param {string} functionName Название функции
   */
  createForSpreadsheetOnEdit(functionName) {
    this.sApp.newTrigger(functionName).forSpreadsheet(this.ss).onEdit().create()
    return this
  }
  /**
   * Установка триггера по времени
   * @param {number} hour время запуска в сутках
   * @param {number} day интервал в днях
   * @param {string} functionName Название функции
   */
  createForSpreadsheetAtHourEveryDays(hour, day, functionName) {
    this.sApp
      .newTrigger(functionName)
      .timeBased()
      .atHour(hour)
      .everyDays(day)
      .create()
    return this
  }
  deleteAllTrigger() {
    const triggers = this.sApp.getProjectTriggers()
    triggers.forEach((trigger) => this.sApp.deleteTrigger(trigger))
    console.log('Deleted triggers: ', triggers.length)
    return this
  }
}
