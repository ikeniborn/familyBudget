import { Hash, FormatDate, FormatObject } from './utils'
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
    this.scriptCache = new ScriptCache(300)
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
    if (WorkSheet.workSheetKey === new Hash(sheetName).md5) {
      return WorkSheet.instance
    }
    WorkSheet.instance = this
    this.workSheetKey = new Hash(sheetName).md5
    this.sheetName = sheetName
    this.headType = head.type
    this.head = head.columns
    this.headRowNum = head.rowNum || 1
    this.firstRowNum = this.headRowNum + 1
    this.headKey = Object.keys(new FormatObject(this.head).getCopy())
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
    this.arrayOfObject = []
    this.object = {}
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
    this.dataRange.getValues().forEach((arrayRow, indexRow) => {
      const rowNum = this.firstRowNum + indexRow
      const rowKey = arrayRow[this.head.rowKey.idx]
      const instanceRow = arrayRow.reduce((object, value, index) => {
        object['rowNum'] = rowNum
        if (!object[this.headKey[index]]) {
          object[this.headKey[index]] = value
        }
        object['rowKey'] = rowKey
        return object
      }, {})
      if (!this.object[rowKey]) {
        this.object[rowKey] = instanceRow
      }
      this.arrayOfObject.push(instanceRow)
    })
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
            object['rowKey'] = rowKey
            return object
          }, {})
        }

        return objectRow
      }, {})
    this.arrayOfObject = Object.values(this.object)
    return this
  }

  getTransactions() {
    this.dataRange.getValues().forEach((arrayRow, indexRow) => {
      const rowNum = this.firstRowNum + indexRow
      const rowId = arrayRow[this.head.rowId.idx]
      const rowKey = new Hash(rowId + this.sheetName).md5
      const instanceRow = arrayRow.reduce((object, value, column) => {
        object['rowKey'] = rowKey
        object['rowNum'] = rowNum
        object['rowId'] = rowId
        if (!object[this.headKey[column]]) {
          object[this.headKey[column]] = value
        }
        return object
      }, {})
      if (!this.object[rowKey]) {
        this.object[rowKey] = instanceRow
      }
      this.arrayOfObject.push(instanceRow)
    })
    return this
  }

  truncateInsertRows(arrayOfObject = [], firstRow = 1, firstColumn = 1) {
    new Promise((resolve, reject) => {
      const action = () => {
        const array = arrayOfObject.reduce(
          (values, rowObject) => {
            const rowArray = this.headKey.map((column) => {
              let value = rowObject[column]
              if (this.head[column]?.default && !value) {
                value = this.head[column].default
              }
              if (this.head[column]?.type === 'date' && value) {
                return new Date(value)
              } else {
                return value
              }
            })
            values.push(rowArray)
            return values
          },
          [new Header().getHeaderAlias(this.head)]
        )

        if (array.length) {
          this.deleteFilter()
          this.workSheet.clear()
          const range = this.workSheet.getRange(
            firstRow,
            firstColumn,
            array.length,
            array[0].length
          )
          range.setValues(array)
          this.createFilter(range)
          return true
        }
      }
      action() ? resolve() : reject(error)
    })
      .then(this.deleteEmptyRows().deleteEmptyColumns())
      .catch((error) => {
        console.error('WorkSheet.updateRow', error.stack)
      })
    return this
  }

  updateRow(object = {}) {
    new Promise((resolve, reject) => {
      const action = () => {
        if (object.rowNum !== this.headRowNum) {
          const array = [
            this.headKey.map((column) => {
              let value = object[column]
              if (this.head[column]?.default && !value) {
                value = this.head[column].default
              }
              if (this.head[column]?.type === 'date') {
                return new Date(value)
              } else {
                return value
              }
            }),
          ]
          this.workSheet
            .getRange(object.rowNum, 1, array.length, array[0].length)
            .setValues(array)

          return true
        }
      }
      action() ? resolve() : reject(error)
    })
      .then(this.deleteEmptyRows().deleteEmptyColumns())
      .catch((error) => {
        console.error('WorkSheet.updateRow', error.stack)
      })
  }

  insertRow(object = {}) {
    new Promise((resolve, reject) => {
      const action = () => {
        const array = this.headKey.map((column) => {
          let value = object[column]
          if (this.head[column]?.default && !value) {
            value = this.head[column].default
          }
          if (this.head[column]?.type === 'date') {
            return new Date(value)
          } else {
            return value
          }
        })
        this.workSheet.appendRow(array)

        return true
      }
      action() ? resolve() : reject(error)
    })
      .then(this.deleteEmptyRows().deleteEmptyColumns())
      .catch((error) => {
        console.error('WorkSheet.insertRow', error.stack)
      })
  }
  /**
   *
   * @param {*} value
   * @param {number} rowNum
   * @param {number} columnNum
   */
  insertValue(value, rowNum, columnNum) {
    if (rowNum !== this.headRowNum) {
      this.workSheet.getRange(rowNum, columnNum).setValue(value)
    }
  }

  /**
   * Вставка диапазона
   * @param {array} arrayOfArray Массив из массивов [[...column]]
   * @param {number} rowStart
   * @param {number} columnStart
   */
  insertRange(arrayOfArray = [], rowStart, columnStart) {
    if (rowStart !== this.headRowNum) {
      const range = this.workSheet.getRange(
        rowStart,
        columnStart,
        arrayOfArray.length,
        arrayOfArray[0].length
      )
      range.setValues(arrayOfArray)
    }
  }

  /**
   *
   * @param {number} rowNum
   * @param {number} countRow
   */
  deleteRow(rowNum, countRow = 1) {
    this.workSheet.deleteRows(rowNum, countRow)
  }

  /**
   *
   * @param {array} arrayOfObject
   */
  deleteRows(arrayOfObject = []) {
    if (arrayOfObject.length) {
      const sortArrayOfObject = arrayOfObject.sort((a, b) => {
        return b.rowNum - a.rowNum
      })
      sortArrayOfObject.forEach((row) => {
        this.deleteRow(row.rowNum)
      })
    }
  }

  deleteFilter() {
    this.filter = {}
    this.filter.customFilter = this.workSheet.getFilter()
    if (this.customFilter) {
      this.filter.isExist = true
      for (i = 1; i <= maxColumn; i++) {
        const criteria = this.customFilter.getColumnFilterCriteria(i)
        if (criteria !== null) {
          this.filter.columnPosition = i
          this.filter.filterCriteria = criteria.copy()
          break
        }
      }
      this.filter.customFilter.remove()
    }
  }
  /**
   *
   * @param {object} range
   */
  createFilter(range = {}) {
    if (!this.workSheet.getFilter()) {
      if (this?.filter?.isExist) {
        range
          .createFilter()
          .setColumnFilterCriteria(
            this.filter.columnPosition,
            this.filter.filterCriteria
          )
      } else {
        range.createFilter().setColumnFilterCri
      }
    }
    return this
  }

  /**
   *  Удаление пустых строк
   */
  deleteEmptyRows() {
    try {
      const countEmptyRow = this.maxRow - this.lastRow
      const firstEmptyRow = this.lastRow + 10
      if (countEmptyRow > 10) {
        this.workSheet.deleteRows(firstEmptyRow, countEmptyRow - 10)
      }
      return this
    } catch (error) {
      console.error('WorkSheet.deleteEmptyRows', error.stack)
    }
  }

  /**
   *  Удаление пустых колонок
   */
  deleteEmptyColumns() {
    try {
      const countEmptyRow = this.maxColumn - this.lastColumn
      const firstEmptyRow = this.lastColumn + 1
      if (countEmptyRow) {
        this.workSheet.deleteColumns(firstEmptyRow, countEmptyRow)
      }
      return this
    } catch (error) {
      console.error('WorkSheet.deleteEmptyColumns', error.stack)
    }
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
    this.workSheet = range.getSheet()
    this.range = range
    this.startRow = this.range.rowStart
    this.rowEnd = this.range.rowEnd
    this.countRow = this.range.rowEnd - this.range.rowStart + 1
    this.countColumn = this.range.columnEnd - this.range.columnStart + 1
    this.firstRowNum = this.range.rowStart
    this.isChangePrimaryKey = false
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
    this.arrayOfObject = []
    this.object = {}
    this.isChangeData = false
    this.workSheetMetadata = new WorkSheetMetadata(this.workSheet)
  }

  get isDeleteRow() {
    return this.countColumn === this.maxColumn
  }

  getFact() {
    try {
      this.dataRange.getValues().forEach((arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow

        const rowKey = arrayRow[this.head.rowKey.idx]
        const instanceRow = arrayRow.reduce((object, value, index) => {
          object['rowNum'] = rowNum
          if (!object[this.headKey[index]]) {
            object[this.headKey[index]] = value
          }
          return object
        }, {})
        if (!this.object[rowKey]) {
          this.object[rowKey] = instanceRow
        }
        this.arrayOfObject.push(instanceRow)
      })
      return this
    } catch (error) {
      console.error('WorkSheetRange.getFact', error.stack)
    }
  }

  getDimension() {
    try {
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
          const newRowKey = this.getPrimaryKey(object)

          object.isChangePrimaryKey = false
          if (object.rowKey !== newRowKey) {
            object.rowKey = newRowKey
            this.isChangePrimaryKey = true
          }
          const isNotNull = this.isNotNull(object)

          if (!objectRow[object.rowKey] && isNotNull) {
            objectRow[object.rowKey] = object
          }
          return objectRow
        }, {})

      this.arrayOfObject = Object.values(this.object)
      this.isChangeData = this.arrayOfObject.length ? true : false
      return this
    } catch (error) {
      console.error('WorkSheetRange.getDimension', error.stack)
    }
  }

  getTransactions() {
    try {
      this.dataRange.getValues().forEach((arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow
        const isChangeRow = this.isChangeRow(rowNum, arrayRow)
        if (isChangeRow.sign) {
          const maxRowId = this.workSheetMetadata.getMaxRowId()
          let isNewRowId = false
          const rowIdOld = arrayRow[this.head.rowId.idx] * 1
          let rowId
          if (rowIdOld) {
            rowId = arrayRow[this.head.rowId.idx]
          } else {
            rowId = maxRowId ? maxRowId + 1 : rowNum
            isNewRowId = true
          }
          const rowKey = new Hash(rowId + this.sheetName).md5
          const rowKeyTimestamp = new Hash(
            rowNum + this.sheetName + 'timestamp'
          ).md5
          const instanceRow = arrayRow.reduce((object, value, column) => {
            if (!object[this.headKey[column]]) {
              object[this.headKey[column]] = value
              object['rowKey'] = rowKey
              object['rowNum'] = rowNum
              object['rowHash'] = isChangeRow.hash
              object['timestamp'] = new Date().valueOf()
              object['rowId'] = rowId
            }
            return object
          }, {})
          const rowHashCache = this.scriptCache.getCache(rowKey)
          if (rowHashCache !== instanceRow.rowHash) {
            this.scriptCache.addCache(rowKey, instanceRow.rowHash)
            this.scriptCache.addCache(rowKeyTimestamp, instanceRow.timestamp)
            const isNotNull = this.isNotNull(instanceRow)
            if (isNotNull) {
              if (isNewRowId) {
                this.workSheetMetadata.addMaxRowId(rowId)
              }
              if (!this.object[rowKey]) {
                this.object[rowKey] = instanceRow
              }
              this.arrayOfObject.push(instanceRow)
            }
          }
        }
      })

      this.isChangeData = this.arrayOfObject.length ? true : false
      return this
    } catch (error) {
      console.error('WorkSheetRange.getTransactions', error.stack)
    }
  }

  savePrimaryKeyChanges() {
    try {
      if (this.firstRowNum !== this.headRowNum) {
        this.arrayOfObject.forEach((object) => {
          this.insertValue(
            object.rowKey,
            object.rowNum,
            this.head.rowKey.idx + 1
          )
          // this.updateRow(object)
        })
      }
    } catch (error) {
      console.error('WorkSheetRange.savePrimaryKeyChanges', error.stack)
    }
  }

  /**
   * Проверка изменения строки
   * @param {number} rowNum номер строки
   * @param {array} arrayRow массив значений строки
   * @returns {object} объект { sign, hash }
   */
  isChangeRow(rowNum, arrayRow = []) {
    try {
      const rowHash = new Hash(arrayRow.join('#')).md5
      const rowHashOld = this.scriptCache.getCache(
        this.sheetName + 'rowkey' + rowNum
      )
      if (rowHash !== rowHashOld) {
        this.scriptCache.addCache(this.sheetName + 'rowkey' + rowNum, rowHash)
        return { sign: true, hash: rowHash }
      } else {
        return { sign: false, hash: rowHash }
      }
    } catch (error) {
      console.error('WorkSheetRange.isChangeRow', error.stack)
    }
  }

  // isChangePrimaryKey(rowObject = {}) {
  //   return Object.keys(this.head)
  //     .filter((column) => this.head[column].pk)
  //     .some((column) => (rowObject[column] ? true : false))
  // }

  isNotNull(rowObject = {}) {
    const data = Object.keys(this.head).filter(
      (column) => this.head[column].notNull
    )
    if (data.length) {
      return data.every((column) => rowObject[column])
    }
    return false
  }

  /**
   * Формирование хэша ключа строки
   * @param {object} rowObject строка в формате {key:value}
   * @returns
   */
  getPrimaryKey(rowObject = {}) {
    return new Hash(
      Object.keys(this.head)
        .filter((column) => this.head[column].pk)
        .map((column) => {
          const value = rowObject[column]
          if (value instanceof Date) {
            return new Date(value).valueOf()
          } else {
            return value
          }
        })
        .join('')
    ).md5
  }

  // getDataset() {
  //   if (this.headType === 'dim') {
  //     this.getDimension()
  //   } else if (this.headType === 'fct') {
  //     this.getFact()
  //   } else if (this.headType === 'tx') {
  //     this.getTransactions()
  //   }
  //   return this
  // }
}

class ScriptCache {
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
  addCache(key, value) {
    const data = JSON.stringify(value)
    this.cache.put(key, data, this.seconds)
  }

  /**
   * Массовое добавление данных в кэш
   * @param {object} object Данные в формате {key:value}
   */
  addAllCache(object) {
    this.cache.putAll(object, this.seconds)
  }

  /**
   * Получаение данных из кэша по ключу
   * @param {string} key
   * @returns
   */
  getCache(key) {
    return JSON.parse(this.cache.get(key)) || void 0
  }

  /**
   * Массовое получаение данных по массиву ключей
   * @param {array} arrayKey Массив ключей
   * @returns
   */
  getAllCache(arrayKey) {
    return this.cache.getAll(arrayKey)
  }

  /**
   * Удаление данных из кэша по ключу
   * @param {string} key
   */
  removeCache(key) {
    this.cache.remove(key)
  }

  /**
   * Массовое удаление данных по массиву ключей
   * @param {array} arrayKey массив ключей
   */
  removeAllCache(arrayKey) {
    this.cache.removeAll(arrayKey)
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
    const arrayMetadataKey = Object.keys(this.metadata)
    arrayMetadataKey.forEach((key) => {
      this.metadata[key].remove()
    })
    console.log('Delete keys: ', arrayMetadataKey.length)
  }
}

class WorkSheetMetadata {
  /**
   * Работа с метаданными листа
   * @param {object} workSheet объект листа
   */
  constructor(workSheet) {
    if (
      WorkSheetMetadata.workSheetNameHashMd5 ===
      new Hash(workSheet.getName()).md5
    ) {
      return WorkSheetMetadata.instance
    }
    WorkSheetMetadata.instance = this
    this.metadata = new Metadata(workSheet)
    this.workSheetNameHash = new Hash(workSheet.getName())
    this.workSheetNameHashMd5 = new Hash(workSheet.getName()).md5
  }

  /**
   * Добавление ключа строки в метаданные
   * @param {number} rowNum номер строки листа
   */
  addRowKey(rowNum, value) {
    const key = 'ROWKEY_' + rowNum
    this.metadata.addMetadata(key, value)
    return value
  }

  getRowKey(rowNum) {
    const key = 'ROWKEY_' + rowNum
    return this.metadata.getMetadata(key)
  }

  /**
   * Добавление максимального идентификатора строки
   * @param {number} rowNum номер строки листа
   */
  addMaxRowId(rowId) {
    this.metadata.addMetadata('MAXROWID', rowId + '')
    return rowId
  }

  /**
   * Получение максимального идентификатора строки
   * @returns Максимальный идентификатор на листе
   */
  getMaxRowId() {
    const data = this.metadata.getMetadata('MAXROWID') * 1
    if (typeof data === 'number') {
      return data
    }
    return void 0
  }

  /**
   * Добавление ключа листа в метаданные
   * @param {string} sheetKey ключ листа в формате Hash
   */
  addSheetKey() {
    const value = this.workSheetNameHash.stringUpperCase
    this.metadata.addMetadata('SHEETKEY', value)
    return value
  }

  /**
   * Получение ключа листа из метаданных
   * @returns ключ листа в формате Hash
   */
  getSheetKey() {
    return this.metadata.getMetadata('SHEETKEY')
  }

  getSheetName() {
    const oldValue = this.metadata.getMetadata('SHEETNAME')
    if (oldValue) {
      return oldValue
    } else {
      this.metadata.addMetadata(
        'SHEETNAME',
        this.workSheetNameHash.stringUpperCase
      )
      return this.workSheetNameHash.stringUpperCase
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
    return this
  }
}
