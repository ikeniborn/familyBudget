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
   * @param {*} headerRowNum
   * @returns
   */
  constructor(spreadSheetName = '', sheetName = '', headerRowNum = 1) {
    super(spreadSheetName)
    if (WorkSheet.key === new Hash(sheetName).md5) {
      return WorkSheet.instance
    }
    WorkSheet.instance = this
    this.workSheetKey = new Hash(sheetName).md5
    this.sheetName = sheetName
    this.workSheet = this.workSheets[this.workSheetKey]
    this.metadata = new WorkSheetMetadata(this.workSheet)
    this.getRange(headerRowNum)
  }

  /**
   * Последняя строка на листе
   */
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

  /**
   *
   * @returns range, countRow, countColumn
   */
  getRange(headerRowNum) {
    const dataRange = this.workSheet.getDataRange()
    this.headerRowNum = headerRowNum
    this.countRow = dataRange.getNumRows() - this.headerRowNum
    this.countColumn = dataRange.getNumColumns()
    //* формирование заголовка
    this.headerRange = dataRange.offset(
      this.headerRowNum - 1,
      0,
      1,
      this.countColumn
    )
    this.dataRange =
      this.countRow > 0
        ? dataRange.offset(
            this.headerRowNum,
            0,
            this.countRow,
            this.countColumn
          )
        : this.headerRange
    return this
  }

  getFact(head) {
    const firstRowNum = this.headerRowNum + 1
    const headKey = Object.keys(head)
    return this.dataRange
      .getValues()
      .reduce((valuesWithKey, rowValues, index) => {
        const rowNum = firstRowNum + index
        let rowKey
        if (head?.rowKey) {
          rowKey = rowValues[head.rowKey.idx]
        } else {
          rowKey = new Hash(rowNum + this.sheetName).md5
        }
        if (!valuesWithKey[rowKey]) {
          valuesWithKey[rowKey] = rowValues.reduce((object, value, index) => {
            if (!head?.rowKey) {
              object['rowKey'] = rowKey
            }
            object['rowNum'] = rowNum
            if (!object[headKey[index]]) {
              object[headKey[index]] = value
            }
            return object
          }, {})
        }
        return valuesWithKey
      }, {})
  }

  getDimension(head) {
    const primeryKeyIndex = new Header().getPrimaryKeyIndex(head)
    const headKey = Object.keys(head)
    return this.dataRange.getValues().reduce((valuesWithKey, values) => {
      const key = new Header().getPrimaryKey(primeryKeyIndex, values)
      if (!valuesWithKey[key]) {
        valuesWithKey[key] = values.reduce((object, value, index) => {
          if (!object[headKey[index]]) {
            object[headKey[index]] = value
          }
          return object
        }, {})
      }
      return valuesWithKey
    }, {})
  }

  insertRows(arrayOfObject = [], head = {}, firstRow = 1, firstColumn = 1) {
    const headOrder = Object.keys(head)
    const array = arrayOfObject.reduce(
      (values, rowObject) => {
        const rowArray = headOrder.map((value) => rowObject[value])
        values.push(rowArray)
        return values
      },
      [new Header().getHeaderAlias(head)]
    )
    console.log(array)
    if (array.length) {
      this.deleteFilter()
      this.workSheet
        .clear()
        .getRange(firstRow, firstColumn, array.length, array[0].length)
        .setValues(array)
      this.deleteEmptyRows().deleteEmptyColumns()
    }
    return this
  }

  updateRow(object = {}, head = {}, rowNum) {
    const headOrder = Object.keys(head)
    const array = [object].reduce((values, rowObject) => {
      const rowArray = headOrder.map((value) => rowObject[value])
      values.push(rowArray)
      return values
    }, [])
    this.workSheet
      .getRange(rowNum, 1, array.length, array[0].length)
      .setValues(array)
  }

  insertRow(object = {}, head = {}) {
    const headOrder = Object.keys(head)
    const array = [object].reduce((values, rowObject) => {
      const rowArray = headOrder.map((value) => rowObject[value])
      values.push(rowArray)
      return values
    }, [])[0]
    // console.log(array)
    this.workSheet.appendRow(array)
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
}

class WorkSheetRange extends WorkSheet {
  constructor(spreadSheetName, sheetName, headerRowNum, range) {
    super(spreadSheetName, sheetName, headerRowNum)
    this.range = range
    this.countRow = this.range.rowEnd - this.range.rowStart + 1
    this.countColumn = this.range.columnEnd - this.range.columnStart + 1
    this.rangeOffset = range.offset(
      0,
      1 - this.range.columnStart,
      this.countRow,
      this.maxColumn
    )
    this.rangeOffsetValues = this.rangeOffset.getValues()
    this.rowNumArray = [...Array(this.countRow).keys()].map(
      (m) => (m = m + this.range.rowStart)
    )
    this.columnNumArray = [...Array(this.countColumn).keys()].map(
      (m) => (m = m + this.range.columnStart)
    )
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

class ModalDialog {
  constructor(htmlTempate, width, height) {
    this.html = htmlTempate
    this.width = width
    this.height = height
  }

  showModalDialog(title) {
    const output = HtmlService.createTemplateFromFile(this.html)
      .evaluate()
      .setWidth(this.width)
      .setHeight(this.height)
    SpreadsheetApp.getUi().showModalDialog(output, title)
  }

  closeModalDialog(title, timer = 200) {
    var output = HtmlService.createHtmlOutput(
      '<script>var myVar = setInterval(myTimer ,' +
        timer +
        ');function myTimer() { google.script.host.close();}</script>'
    )
      .setWidth(this.width)
      .setHeight(this.height)
    SpreadsheetApp.getUi().showModalDialog(output, title)
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
