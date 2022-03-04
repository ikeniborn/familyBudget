export { GasEnvironment, GasSpreadSheet, GasWorkSheet }

class GasEnvironment {
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
    if (GasEnvironment.exists) {
      return GasEnvironment.instance
    }
    GasEnvironment.instance = this
    GasEnvironment.exists = true
    this.getEnvironment(environment)
  }

  getEnvironment(environment) {
    const currentArea = environment.reduce((area, row) => {
      if (row.scriptId === ScriptApp.getScriptId()) {
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
          // if (!row.excludeSheetName) {
          //   this[ssName].excludeSheetName = []
          // } else {
          //   this[ssName].excludeSheetName = row.excludeSheetName.map((m) =>
          //     m.toLowerCase()
          //   )
          // }
        }
      })
    } else {
      console.error('Check environment!!!')
    }
  }
}

class GasSpreadSheet {
  constructor(spreadSheetName = '', excludeSheetName = []) {
    const instance = new GasEnvironment()[spreadSheetName]
    this.spreadSheet = instance.spreadSheet
    this.excludeSheetName = excludeSheetName.map((m) => (m = m.toLowerCase()))
  }
}

class GasWorkSheet extends GasSpreadSheet {
  constructor(
    spreadSheetName = '',
    sheetName = '',
    headerRowNum = 1,
    getRowNum = false,
    getRowHash = false
  ) {
    super(spreadSheetName)
    this.sheetName = sheetName.toLowerCase()
    this.workSheet = this.spreadSheet
      .getSheets()
      .filter(
        (f) =>
          f.getName().toLowerCase() === this.sheetName &&
          this.excludeSheetName.indexOf(this.sheetName) === -1
      )[0]
    this.getRange(headerRowNum).getValues(getRowNum, getRowHash)
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
    this.countRow = dataRange.getNumRows() - headerRowNum
    this.countColumn = dataRange.getNumColumns()
    //* формирование заголовка
    this.headerRange = dataRange.offset(
      headerRowNum - 1,
      0,
      1,
      this.countColumn
    )
    this.dataRange =
      this.countRow > 0
        ? dataRange.offset(headerRowNum, 0, this.countRow, this.countColumn)
        : this.headerRange
    return this
  }

  getValues(getRowNum, getRowHash) {
    this.headerValues = this.headerRange.getValues()[0]
    if (getRowNum && !getRowHash) {
      this.headerValues = ['rowNum', ...this.headerValues]
    } else if (!getRowNum && getRowHash) {
      this.headerValues = ['hashKey', ...this.headerValuesw]
    } else if (getRowNum && getRowHash) {
      this.headerValues = ['rowNum', 'hashKey', ...this.headerValues]
    }
    this.dataObject = []
    this.dataValues = []
    this.dataRange.getValues().forEach((row, index) => {
      let rowValues
      if (getRowNum && !getRowHash) {
        const rowNum = index + this.headerRowNum + 1
        rowValues = [rowNum, ...row]
      } else if (!getRowNum && getRowHash) {
        rowValues = [new Hash(row.join('#')).md5, ...row]
      } else if (getRowNum && getRowHash) {
        const rowNum = index + this.headerRowNum + 1
        rowValues = [rowNum, new Hash(row.join('#')).md5, ...row]
      } else {
        rowValues = row
      }
      const rowObject = rowValues.reduce((keyValue, value, index) => {
        if (!keyValue[this.headerValues[index]]) {
          keyValue[this.headerValues[index]] = value
        }
        return keyValue
      }, {})
      this.dataValues.push(rowValues)
      this.dataObject.push(rowObject)
    })
    return this
  }

  insertValues(values = [], header = [], firstRow = 1, firstColumn = 1) {
    values.splice(0, 0, header)
    if (values.length) {
      this.workSheet
        .clear()
        .getRange(firstRow, firstColumn, values.length, values[0].length)
        .setValues(values)
    }
    return this
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
   *  Удаление пустых колоно
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

class SheetMetadata extends Metadata {
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
  addRowKey(rowNum) {
    const key = 'ROWKEY_' + rowNum
    const value = new Hash(this.sheetName + '#' + rowNum).md5
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
