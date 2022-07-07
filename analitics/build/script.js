class Hash {
  /**
   *
   * @param {string} string
   */
  constructor(string) {
    typeof string === 'string'
      ? (this.stringLowerCase = string.toLowerCase())
      : (this.stringLowerCase = (string + '').toString().toLowerCase());
    this.stringUpperCase = this.stringLowerCase.toUpperCase();
  }

  get md5() {
    let hexstr = '';
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      this.stringLowerCase.replace(/[$+\s+]/g, '_').trim()
    );
    for (let i = 0; i < digest.length; i++) {
      var val = (digest[i] + 256) % 256;
      hexstr += ('0' + val.toString(16)).slice(-2);
    }
    return hexstr
  }
}

class FormatDate {
  /**
   * Форматирование и преобразование даты
   * @param {date} date значение даты. По умолчанию - текущее значение
   * @param {string} timeZone часовой пояс в формате GMT. По умолчанию - GMT+3
   */
  constructor(date = new Date(), timeZone = 'GMT+3') {
    this.date = new Date(date);
    this.timeZone = timeZone;
  }
  /**
   * Дата в формате dd.MM.yyyy
   */
  getFormatDate(format = 'dd.MM.yyyy') {
    return Utilities.formatDate(new Date(this.date), this.timeZone, format)
  }
  /**
   * Значение даты в формате строки
   */
  get string() {
    return JSON.stringify(this.date)
  }
  /**
   * Значение даты в формате строки
   */
  get md5() {
    return new Hash(this.yyyymmdd).md5
  }
  /**
   * Год в числовой формате YYYY
   */
  get year() {
    return this.date.getFullYear()
  }
  /**
   * Месяц
   */
  get month() {
    return this.date.getMonth() + 1
  }
  /**
   * День недели
   */
  get weekDay() {
    return this.date.getDay() + 1
  }
  /**
   * День месяца
   */
  get monthDay() {
    return this.date.getDate()
  }
  /**
   * Дата в формате числа YYYYMMDD
   */
  get yyyymmdd() {
    const year = this.date.getFullYear() + '';
    let month = this.date.getMonth() + 1 + '';
    let day = this.date.getDate() + '';
    month.toString().length === 1 ? (month = '0' + month) : (month = month);
    day.toString().length === 1 ? (day = '0' + day) : (day = day);
    return year + month + day
  }
  /**
   * Дата в формате числа YYYYMM
   */
  get yyyymm() {
    const year = this.date.getFullYear() + '';
    let month = this.date.getMonth() + 1 + '';
    month.toString().length === 1 ? (month = '0' + month) : (month = month);
    return year + month
  }

  /**
   * Номер недели по стандурту ISO
   */
  get week() {
    return this.date.getISOWeek()
  }

  get unix() {
    return Math.round(new Date(this.date).valueOf() / 1000)
  }

  get value() {
    return new Date(this.date).valueOf()
  }

  /**
   * Преобразование даты в числовом виде в дату
   * @param {number} YYYYMMDD дата в числовом формате
   * @returns
   */
  getDateFromYYYYMMDD(YYYYMMDD = 19700101) {
    const year = YYYYMMDD.substr(0, 4) * 1;
    const month = YYYYMMDD.substr(4, 2) * 1 - 1;
    const day = YYYYMMDD.substr(6, 2) * 1;
    this.date = new Date(year, month, day);
    return this
  }

  addTime(h = 0, m = 0) {
    this.date = new Date(this.year, this.month - 1, this.monthDay, h, m);
    return this
  }
  /**
   * РАсчет длительности от указанной и текущей даты
   * @returns разница во времени в формате hh:mm:ss.ms
   */
  getTimeDiff() {
    const endDate = new Date();
    const tdiff = endDate.getTime() - this.date.getTime();
    const str = this.timeToStr(tdiff);
    return str
  }
  /**
   * Приведение времени к формату hh:mm:ss.ms
   * @param {number} time время в числовом формате
   * @returns время в формате hh:mm:ss.ms
   */
  timeToStr(time) {
    let t = time;
    let ms = t % 1000;
    t -= ms;
    ms = Math.floor(ms / 10);
    t = Math.floor(t / 1000);
    let s = t % 60;
    t -= s;
    t = Math.floor(t / 60);
    let m = t % 60;
    t -= m;
    t = Math.floor(t / 60);
    let h = t % 60;
    if (h < 10) h = '0' + h;
    if (m < 10) m = '0' + m;
    if (s < 10) s = '0' + s;
    if (ms < 10) ms = '0' + ms;
    return h + ':' + m + ':' + s + '.' + ms
  }
  /**
   * Получение прошлой даты на заданное количество дней
   * @param {number} day количество дней
   * @returns Дата
   */
  getPreviousDate(day) {
    const startDate = new Date(this.date);
    this.date = new Date(startDate.setDate(this.date.getDate() - day));
    return this
  }

  /**
   * Расчет количества дней между двух дат. Даты приводятся к началу дню.
   * @param {date} endDate - Дата окончания. По умолчанию: текущая дата
   * @returns Количество полных дней
   */
  diffBetweenDate(endDate = new Date()) {
    const strtdt = this.date.getDateBegin();
    const enddt = new Date(endDate).getDateBegin();
    if (new Date(strtdt).getFullYear() > 2000) {
      const diff = Math.round(
        (enddt.getTime() - strtdt.getTime()) / (24 * 3600 * 1000)
      );
      return isNaN(diff) ? 0 : diff
    } else {
      return 0
    }
  }
}

//* Get start date
Date.prototype.getDateBegin = function () {
  const sourceDate = new Date(this);
  const tmzn = 'Europe/Moscow';
  ScriptApp.get;
  const strDate = Utilities.formatDate(
    sourceDate,
    tmzn,
    'MMMM dd, yyyy 00:00:00 Z'
  );
  return new Date(strDate)
};

Object.prototype.isEmpty = function () {
  if (Object.keys(this).length === 0) {
    return true
  }
  return false
};

class FormatObject {
  constructor(object = {}) {
    this.object = object;
  }
  getCopy() {
    return JSON.parse(JSON.stringify(this.object))
  }
}

String.prototype.isEmpty = function () {
  if (Object.values(this).every((value) => value === '')) {
    return true
  }
  return false
};

class Header {
  /**
   * Get head alias
   * @param {object} head Header object
   * @returns {array}
   */
  getHeaderAlias(head) {
    return Object.values(head).map((m) => m.alias)
  }

  getHead(workSheetHeads, sheetName) {
    const head = Object.entries(workSheetHeads).reduce(
      (object, [key, value]) => {
        if (!object[new Hash(key).md5]) {
          object[new Hash(key).md5] = value;
        }
        return object
      },
      {}
    );
    return head[new Hash(sheetName).md5]
  }
}

//* Deprecated
//* Header
// getPrimaryKey(head = {}, rowObject = {}) {
//   return new Hash(
//     Object.keys(head)
//       .filter((column) => head[column].pk)
//       .map((column) => {
//         const value = rowObject[column]
//         if (value instanceof Date) {
//           return new Date(value).valueOf()
//         } else {
//           return value
//         }
//       })
//       .join('')
//   ).md5
// }

// isChangePrimaryKey(head, rowObject = {}) {
//   return Object.keys(head)
//     .filter((column) => head[column].pk)
//     .some((column) => (rowObject[column] ? true : false))
// }

// isNotNull(head, rowObject = {}) {
//   const data = Object.keys(head).filter((column) => head[column].notNull)
//   if (data.length) {
//     return data.every((column) => rowObject[column])
//   }
//   return false
// }

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
    Environment.instance = this;
    Environment.exists = true;
    this.getEnvironment(environment);
  }

  getEnvironment(environment) {
    const scriptId = ScriptApp.getScriptId();
    const currentArea = environment.reduce((area, row) => {
      if (row.scriptId === scriptId) {
        area = row.area;
      }
      return area
    }, '');
    if (currentArea) {
      environment.forEach((row) => {
        if (row.area === currentArea) {
          const spreadSheet = SpreadsheetApp.openById(row.sheetId);
          const spreadSheetName = row.spreadSheetName.toLowerCase();
          if (!this[spreadSheetName]) {
            this[spreadSheetName] = {};
          }
          this[spreadSheetName].spreadSheet = spreadSheet;
        }
      });
    } else {
      console.error('Check environment!!!');
    }
  }
}

class SpreadSheet {
  constructor(spreadSheetName = '', excludeSheetName = []) {
    spreadSheetName = spreadSheetName.toString().toLowerCase();
    if (SpreadSheet.spreadSheetName === spreadSheetName) {
      return SpreadSheet.instance
    }
    SpreadSheet.instance = this;
    const instance = new Environment()[spreadSheetName];
    this.spreadSheetName = spreadSheetName;
    this.spreadSheet = instance.spreadSheet;
    this.excludeSheetName = excludeSheetName.map((m) => new Hash(m).md5);
    this.workSheets = this.spreadSheet
      .getSheets()
      .reduce((workSheets, workSheet) => {
        const key = new Hash(workSheet.getName()).md5;
        if (!workSheets[key] && this.excludeSheetName.indexOf(key) === -1) {
          workSheets[key] = workSheet;
        }
        return workSheets
      }, {});
    this.scriptCache = new ScriptCache(300);
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
    super(spreadSheetName);
    if (WorkSheet.workSheetKey === new Hash(sheetName).md5) {
      return WorkSheet.instance
    }
    WorkSheet.instance = this;
    this.workSheetKey = new Hash(sheetName).md5;
    this.sheetName = sheetName;
    this.headType = head.type;
    this.head = head.columns;
    this.headRowNum = head.rowNum || 1;
    this.firstRowNum = this.headRowNum + 1;
    this.headKey = Object.keys(new FormatObject(this.head).getCopy());
    this.workSheet = this.workSheets[this.workSheetKey];
    this.isRange = false;
    this.arrayOfObject = [];
    this.object = {};
    this.filter = {};
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

  getWorkSheetRange() {
    this.range = this.workSheet.getDataRange();
    this.countRow = this.range.getNumRows() - this.headRowNum;
    this.countColumn = this.range.getNumColumns();
    this.dataRange =
      this.countRow > 0
        ? this.workSheet
            .getDataRange()
            .offset(this.headRowNum, 0, this.countRow, this.countColumn)
        : this.workSheet
            .getDataRange()
            .offset(this.headRowNum - 1, 0, 1, this.countColumn);
    return this
  }

  getFact() {
    this.dataRange.getValues().forEach((arrayRow, indexRow) => {
      const rowNum = this.firstRowNum + indexRow;
      const rowKey = arrayRow[this.head.rowKey.idx];
      const instanceRow = arrayRow.reduce((object, value, index) => {
        object['rowNum'] = rowNum;
        if (!object[this.headKey[index]]) {
          object[this.headKey[index]] = value;
        }
        object['rowKey'] = rowKey;
        return object
      }, {});
      if (!this.object[rowKey]) {
        this.object[rowKey] = instanceRow;
      }
      this.arrayOfObject.push(instanceRow);
    });

    return this
  }

  getDimension() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow;
        const rowKey = arrayRow[this.head.rowKey.idx];
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = arrayRow.reduce((object, value, index) => {
            if (!object[this.headKey[index]]) {
              object[this.headKey[index]] = value;
            }
            object['rowNum'] = rowNum;
            object['rowKey'] = rowKey;
            return object
          }, {});
        }

        return objectRow
      }, {});
    this.arrayOfObject = Object.values(this.object);
    return this
  }

  getTransactions() {
    this.dataRange.getValues().forEach((arrayRow, indexRow) => {
      const rowNum = this.firstRowNum + indexRow;
      const rowId = arrayRow[this.head.rowId.idx];
      const rowKey = new Hash(rowId + this.sheetName).md5;
      const instanceRow = arrayRow.reduce((object, value, column) => {
        object['rowKey'] = rowKey;
        object['rowNum'] = rowNum;
        object['rowId'] = rowId;
        if (!object[this.headKey[column]]) {
          object[this.headKey[column]] = value;
        }
        return object
      }, {});
      if (!this.object[rowKey]) {
        this.object[rowKey] = instanceRow;
      }
      this.arrayOfObject.push(instanceRow);
    });
    return this
  }

  /**
   *
   * @param {array} arrayOfObject
   * @param {number} firstRow
   * @param {number} firstColumn
   * @returns
   */
  truncateInsertRows(arrayOfObject = [], firstRow = 1, firstColumn = 1) {
    new Promise((resolve, reject) => {
      const action = () => {
        const array = arrayOfObject.reduce(
          (values, rowObject) => {
            const rowArray = this.headKey.map((column) => {
              let value = rowObject[column];
              if (!value) {
                if (this.head[column]?.default) {
                  if (this.head[column]?.type === 'date') {
                    value = new Date(this.head[column].default);
                  } else {
                    value = this.head[column].default;
                  }
                }
              }
              return value
            });
            values.push(rowArray);
            return values
          },
          [new Header().getHeaderAlias(this.head)]
        );
        if (array.length) {
          this.deleteFilter();
          this.workSheet.clear();
          const range = this.workSheet.getRange(
            firstRow,
            firstColumn,
            array.length,
            array[0].length
          );
          range.setValues(array);
          this.createFilter(range);
          return true
        }
      };
      action() ? resolve() : reject(error);
    })
      .then(() => {
        this.deleteEmptyRows().deleteEmptyColumns();
      })
      .catch((error) => {
        console.error('WorkSheet.truncateInsertRows', error.stack);
      });
    return this
  }

  /**
   *
   * @param {object} rowObject
   * @returns object
   */
  getRowObject(rowObject = {}) {
    return this.headKey.reduce((newRowObject, column) => {
      if (!newRowObject[column] && rowObject[column]) {
        newRowObject[column] = rowObject[column];
        if (this.head[column]?.default) {
          if (this.head[column]?.type === 'date') {
            value[column] = new Date(this.head[column].default);
          } else {
            value[column] = this.head[column].default;
          }
        }
      }

      return rowObject
    }, {})
  }

  /**
   *
   * @param {object} rowObject
   */
  updateRow(rowObject = {}) {
    new Promise((resolve, reject) => {
      const action = () => {
        if (rowObject.rowNum !== this.headRowNum) {
          const array = [
            this.headKey.map((column) => {
              let value = rowObject[column];
              if (!value) {
                if (this.head[column]?.default) {
                  if (this.head[column]?.type === 'date') {
                    value = new Date(this.head[column].default);
                  } else {
                    value = this.head[column].default;
                  }
                }
              }
              return value
            }),
          ];
          this.workSheet
            .getRange(rowObject.rowNum, 1, array.length, array[0].length)
            .setValues(array);

          return true
        }
      };
      action() ? resolve() : reject(error);
    })
      .then(this.deleteEmptyRows().deleteEmptyColumns())
      .catch((error) => {
        console.error('WorkSheet.updateRow', error.stack);
      });
  }

  /**
   *
   * @param {object} rowObject
   */
  insertRow(rowObject = {}) {
    new Promise((resolve, reject) => {
      const action = () => {
        const array = this.headKey.map((column) => {
          let value = rowObject[column];
          if (!value) {
            if (this.head[column]?.default) {
              if (this.head[column]?.type === 'date') {
                value = new Date(this.head[column].default);
              } else {
                value = this.head[column].default;
              }
            }
          }
          return value
        });
        this.workSheet.appendRow(array);

        return true
      };
      action() ? resolve() : reject(error);
    })
      .then(this.deleteEmptyRows().deleteEmptyColumns())
      .catch((error) => {
        console.error('WorkSheet.insertRow', error.stack);
      });
  }

  /**
   *
   * @param {*} value
   * @param {number} rowNum
   * @param {number} columnNum
   */
  insertValue(value, rowNum, columnNum) {
    if (rowNum !== this.headRowNum) {
      this.workSheet.getRange(rowNum, columnNum).setValue(value);
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
      );
      range.setValues(arrayOfArray);
    }
  }

  /**
   *
   * @param {number} rowNum
   * @param {number} countRow
   */
  deleteRow(rowNum, countRow = 1) {
    this.workSheet.deleteRows(rowNum, countRow);
  }

  /**
   *
   * @param {array} arrayOfObject
   */
  deleteRows(arrayOfObject = []) {
    if (arrayOfObject.length) {
      const sortArrayOfObject = arrayOfObject.sort((a, b) => {
        return b.rowNum - a.rowNum
      });
      sortArrayOfObject.forEach((row) => {
        this.deleteRow(row.rowNum);
      });
    }
  }

  /**
   *
   * @returns
   */
  deleteFilter() {
    this.filter.customFilter = this.workSheet.getFilter();
    if (this.filter.customFilter) {
      this.filter.isExist = true;
      for (let i = 1; i <= this.maxColumn; i++) {
        const criteria = this.filter.customFilter.getColumnFilterCriteria(i);

        if (criteria !== null) {
          this.filter.columnPosition = i;
          this.filter.filterCriteria = criteria.copy();
          break
        }
      }
      if (this.filter.columnPosition) {
        this.filter.customFilter.remove();
      }
    }
    return this
  }

  /**
   *
   * @param {object} range
   */
  createFilter(range) {
    if (!this.workSheet.getFilter()) {
      if (this.filter?.isExist) {
        range
          .createFilter()
          .setColumnFilterCriteria(
            this.filter.columnPosition,
            this.filter.filterCriteria
          );
      } else {
        range.createFilter();
      }
    }
    return this
  }

  /**
   *  Удаление пустых строк
   */
  deleteEmptyRows() {
    try {
      const countEmptyRow = this.maxRow - this.lastRow;
      const firstEmptyRow = this.lastRow + 10;
      if (countEmptyRow > 10) {
        this.workSheet.deleteRows(firstEmptyRow, countEmptyRow - 10);
      }
      return this
    } catch (error) {
      console.error('WorkSheet.deleteEmptyRows', error.stack);
    }
  }

  /**
   *  Удаление пустых колонок
   */
  deleteEmptyColumns() {
    try {
      const countEmptyRow = this.maxColumn - this.lastColumn;
      const firstEmptyRow = this.lastColumn + 1;
      if (countEmptyRow) {
        this.workSheet.deleteColumns(firstEmptyRow, countEmptyRow);
      }
      return this
    } catch (error) {
      console.error('WorkSheet.deleteEmptyColumns', error.stack);
    }
  }

  getDataset() {
    if (this.headType === 'dim') {
      this.isRange
        ? this.getDimension()
        : this.deleteFilter().getWorkSheetRange().getDimension();
    } else if (this.headType === 'fct') {
      this.isRange
        ? this.getFact()
        : this.deleteFilter().getWorkSheetRange().getFact();
    } else if (this.headType === 'tx') {
      this.isRange
        ? this.getTransactions()
        : this.deleteFilter().getWorkSheetRange().getTransactions();
    }
    return this
  }
}

class ScriptCache {
  /**
   * Работа с кэшем Google
   * @param {integer} seconds Время хранения кэша в секундах
   */
  constructor(seconds = 60) {
    this.seconds = seconds;
    this.cache = CacheService.getScriptCache();
  }

  /**
   * Добавление в кэш по ключу. Данные приводятся к строке
   * @param {object} object - Данные в формате {key:value}
   * @param data - строка
   */
  addCache(key, value) {
    const data = JSON.stringify(value);
    this.cache.put(key, data, this.seconds);
  }

  /**
   * Массовое добавление данных в кэш
   * @param {object} object Данные в формате {key:value}
   */
  addAllCache(object) {
    this.cache.putAll(object, this.seconds);
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
    this.cache.remove(key);
  }

  /**
   * Массовое удаление данных по массиву ключей
   * @param {array} arrayKey массив ключей
   */
  removeAllCache(arrayKey) {
    this.cache.removeAll(arrayKey);
  }
}

new Environment([
  {
    spreadSheetName: 'analitics',
    sheetId: '10QgekcQTxaUi22eef9QPefk9JK7OjQwhlMBlkD7bCeg',
    scriptId: '1ht5DfnNxdP_qCUP1eM78UY_IsIr7PpcD63fDAX3X0x5Q-XccrzP0Zq35',
    area: 'prod',
  },
]);

class Analitics {
  constructor() {
    if (Analitics.exists) {
      return Analitics.instance
    }
    Analitics.instance = this;
    Analitics.exists = true;
    this.workSheetHeads = {
      history: {
        type: 'tx',
        rowNum: 1,
        columns: {
          dateKey: { alias: 'dateKey', idx: 0 },
          date: { alias: 'date', idx: 1 },
          dateUnix: { alias: 'dateUnix', idx: 2 },
          tokenATokenB: { alias: 'tokenATokenB', idx: 3 },
          tokenAPrice: { alias: 'tokenAPrice', idx: 4 },
          tokenBPrice: { alias: 'tokenBPrice', idx: 5 },
          coefPrice: { alias: 'coefPrice', idx: 6 },
          lrCoefPrice: { alias: 'lrCoefPrice', idx: 7 },
          lrCoefPriceHigh: { alias: 'lrCoefPriceHigh', idx: 8 },
          lrCoefPriceLow: { alias: 'lrCoefPriceLow', idx: 9 },
          stdevPositiveArraydiffCoefPricestoLr: {
            alias: 'stdevPositiveArraydiffCoefPricestoLr',
            idx: 10,
          },
          varPositiveArraydiffCoefPricestoLr: {
            alias: 'varPositiveArraydiffCoefPricestoLr',
            idx: 11,
          },
          stdevNegativeArraydiffCoefPricestoLr: {
            alias: 'stdevNegativeArraydiffCoefPricestoLr',
            idx: 12,
          },
          varNegativeArraydiffCoefPricestoLr: {
            alias: 'varNegativeArraydiffCoefPricestoLr',
            idx: 13,
          },
          tokenAMarketCap: { alias: 'tokenAMarketCap', idx: 14 },
          tokenBMarketCap: { alias: 'tokenBMarketCap', idx: 15 },
          coefPriceMarketCap: { alias: 'coefPriceMarketCap', idx: 16 },
          lrCoefPriceMarketCap: { alias: 'lrCoefPriceMarketCap', idx: 17 },
          tokenAVolume: { alias: 'tokenAVolume', idx: 18 },
          tokenBVolume: { alias: 'tokenBVolume', idx: 19 },
          coefVolume: { alias: 'coefVolume', idx: 20 },
          lrCoefVolume: { alias: 'lrCoefVolume', idx: 21 },
          tokenAVolatility: { alias: 'tokenAVolatility', idx: 22 },
          tokenBVolatility: { alias: 'tokenBVolatility', idx: 23 },
          coefVolatility: { alias: 'coefVolatility', idx: 24 },
          lrCoefVolatility: { alias: 'lrCoefVolatility', idx: 25 },
          rowId: { alias: 'Row ID', idx: 26 },
        },
      },
    };
    this.spreadSheetName = 'analitics';
  }

  getWorkSheet(sheetName) {
    try {
      let headSheetName;
      headSheetName = sheetName;
      const head = new Header().getHead(this.workSheetHeads, headSheetName);
      const workSheet = new WorkSheet(
        this.spreadSheetName,
        sheetName,
        head
      ).getDataset();
      return workSheet
    } catch (error) {
      console.error('Analitics.getWorkSheet', error.stack);
    }
  }
}

// Deprecated
// flowSymbol: {
//   type: 'tx',
//   rowNum: 1,
//   columns: {
//     account: { alias: 'Account', idx: 0 },
//     symbol: { alias: 'Symbol', idx: 1 },
//     symbolKey: { alias: 'Symbol key', idx: 2 },
//     quantityOwnInFlow: { alias: 'Quantity own in flow', idx: 3 },
//     quantityInFlow: { alias: 'Quantity in flow', idx: 4 },
//     quantityOutFlow: { alias: 'Quantity out flow', idx: 5 },
//     quantityRest: { alias: 'Quantity rest', idx: 6 },
//     quantityRestLock: { alias: 'Quantity rest lock', idx: 7 },
//     quantityRestUnlock: { alias: 'Quantity rest unlock', idx: 8 },
//     priceOwnInFlow: { alias: 'Price own in flow', idx: 9 },
//     priceInFlow: { alias: 'Price in flow', idx: 10 },
//     priceOutFlow: { alias: 'Price out flow', idx: 11 },
//     priceRest: { alias: 'Price rest', idx: 12 },
//     costOwnInFlow: { alias: 'Cost own in flow', idx: 13 },
//     costInFlow: { alias: 'Cost in flow', idx: 14 },
//     costOutFlow: { alias: 'Cost out flow', idx: 15 },
//     costRest: { alias: 'Cost rest', idx: 16 },
//     costRestInFlow: { alias: 'Cost rest in flow', idx: 17 },
//     costRestLock: { alias: 'Cost rest lock', idx: 18 },
//     costRestUnlock: { alias: 'Cost rest unlock', idx: 19 },
//     pnlTotal: { alias: 'PnL total', idx: 20 },
//     pnlRest: { alias: 'PnL rest', idx: 21 },
//     payback: { alias: 'Payback', idx: 22 },
//     dayInPortfolioAvg: {
//       alias: 'Day in Portfolio (avg)',
//       idx: 23,
//     },
//     update: {
//       alias: 'Update',
//       idx: 24,
//       type: 'date',
//       default: new Date(),
//     },
//   },
// },

class Methods {
  constructor(
    permanentParams = {
      domain: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addPermanentParams(permanentParams);
  }

  addPermanentParams(permanentParams) {
    this.domain = permanentParams.domain;
    delete permanentParams?.domain;
    this.params = permanentParams;
  }

  addVariableParams(variableParams) {
    this.url = this.domain + (variableParams?.endPoint || '');
    delete variableParams?.endPoint;
    Object.entries(variableParams).forEach((param) => {
      if (!this.params[param[0]]) {
        this.params[param[0]] = param[1];
      } else {
        Object.entries(param[1]).forEach((subParams) => {
          if (!this.params[param[0]][subParams[0]]) {
            this.params[param[0]][subParams[0]] = subParams[1];
          } else {
            //* re-write permanent parametrs
            this.params[param[0]][subParams[0]] = subParams[1];
          }
        });
      }
    });
  }

  post(
    variableParams = {
      endPoint: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addVariableParams(variableParams);
    this.params.data.method = 'post';
    return new Fetch(this.url, this.params).fetch()
  }

  put(
    variableParams = {
      endPoint: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addVariableParams(variableParams);
    this.params.data.method = 'put';
    return new Fetch(this.url, this.params).fetch()
  }

  get(
    variableParams = {
      endPoint: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addVariableParams(variableParams);
    this.params.data.method = 'get';
    return new Fetch(this.url, this.params).fetch()
  }

  del(
    variableParams = {
      endPoint: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addVariableParams(variableParams);
    this.params.data.method = 'delete';
    return new Fetch(this.url, this.params).fetch()
  }
}

class Fetch {
  /**
   * Create url and send fetch
   *
   * @param {string} url domain url
   * @param {object} params parametrs { path: {}, query: {}, data: {} }
   */
  constructor(url, params = { path: {}, query: {}, data: {} }) {
    this.result = '';
    this.getParametr(params);
    this.createUrl(url);
  }

  getParametr(params) {
    const pMap = new Map(Object.entries(params));
    !pMap.has('path') ? (this.path = {}) : (this.path = pMap.get('path'));
    !pMap.has('query') ? (this.query = {}) : (this.query = pMap.get('query'));
    !pMap.has('data') ? (this.data = {}) : (this.data = pMap.get('data'));
  }

  createPathParametrs(url, path) {
    return url.replace(
      new RegExp('{([^{]+)}', 'g'),
      function (_unused, varName) {
        return path[varName]
      }
    )
  }

  createQueryParametrs(query) {
    return Object.entries(query).reduce((queryString, query, index) => {
      if (query[1]) {
        if (!index) {
          queryString += '?' + query[0] + '=' + query[1];
        } else {
          queryString += '&' + query[0] + '=' + query[1];
        }
      }
      return queryString
    }, '')
  }

  createUrl(url) {
    this.url =
      this.createPathParametrs(url, this.path) +
      this.createQueryParametrs(this.query);
  }
  /**
   * Send fetch
   * @param {object} data fetch parametr
   * @returns {object} Responce data from fetch
   */
  fetch() {
    try {
      // const fetchPromise = (result = {}) => {
      //   return new Promise((resolve, reject) => {
      //     const response = UrlFetchApp.fetch(this.url, this.data)
      //     result.code = response.getResponseCode()
      //     if (result.code === 200) {
      //       this.result = JSON.parse(response.getContentText())
      //       result.fetchStatus = true
      //       resolve(result)
      //     } else {
      //       reject(result)
      //     }
      //   })
      // }
      // const timeOutPromise = (result) => {
      //   return new Promise((resolve) => {
      //     console.log('URL: ' + this.url)
      //     console.log('Response code: ' + code)
      //     console.log('Start timeout: ' + this.ms / 1000 + ' sec')
      //     Utilities.sleep(this.ms)
      //     result.ms += 250
      //     result.iteration += 1
      //     if (result.iteration > 5) {
      //       result.fetchStatus = true
      //     }
      //     resolve(result)
      //   })
      // }

      const stepResult = {
        code: 0,
        fetchStatus: false,
        ms: 250,
        iteration: 0,
        response: void 0,
      };
      do {
        const response = UrlFetchApp.fetch(this.url, this.data);
        stepResult.code = response.getResponseCode();
        if (stepResult.code === 200) {
          // console.log('URL: ' + this.url, 'Response code: ' + stepResult.code)
          stepResult.response = JSON.parse(response.getContentText());
          stepResult.fetchStatus = true;
        } else {
          console.log(
            'URL: ' + this.url,
            'Response code: ' + stepResult.code,
            'Responce: ' + response,
            'Iteration: ' + stepResult.iteration,
            'Start timeout: ' + stepResult.ms / 1000 + ' sec'
          );
          stepResult.iteration += 1;
          stepResult.ms += 500;
          Utilities.sleep(stepResult.ms);
        }
        if (stepResult.iteration > 10) {
          stepResult.fetchStatus = true;
        }
      } while (!stepResult.fetchStatus)

      return stepResult.response
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * CoinGecko instance
 */
class Instance {
  /**
   * Create new inctance API CoinGecko
   */
  constructor() {
    if (Instance.exists) {
      return Instance.instance
    }
    Instance.instance = this;
    Instance.exists = true;
    this.methods = new Methods({
      domain: 'https://api.coingecko.com/api/v3',
      data: {
        muteHttpExceptions: true,
        header: 'accept: application/json',
      },
    });
  }
}

class Coins {
  constructor() {
    this.methods = new Instance().methods;
  }
  /**
   *
   * @param {*} include_platform
   * @returns
   */
  getCoinsList(include_platform = false) {
    return (
      this.methods.get({
        endPoint: '/coins/list',
        query: {
          include_platform,
        },
      }) || []
    )
  }

  getCoinsRange(
    id = 'bitcoin',
    vs_currency = 'usd',
    fromUnix = void 0,
    toUnix = void 0
  ) {
    const lowerVs_currency = vs_currency.toLowerCase();
    const lowerId = id.toLowerCase();
    const result =
      this.methods.get({
        endPoint: '/coins/{id}/market_chart/range',
        path: {
          id: lowerId,
        },
        query: {
          vs_currency: lowerVs_currency,
          from: fromUnix + '',
          to: toUnix + '',
        },
      }) || {};

    if (Object.keys(result).length) {
      const aggData = result?.prices.reduce((object, [dateValue, data]) => {
        const dateUnix = new FormatDate(dateValue).unix;
        const dateKey = new Hash(dateUnix).md5;
        if (!object[dateKey]) {
          object[dateKey] = {
            dateUnix: dateUnix,
            price: data,
            marketCap: void 0,
            volume: void 0,
          };
        }
        return object
      }, {});
      result?.market_caps.forEach(([dateValue, data]) => {
        const dateUnix = new FormatDate(dateValue).unix;
        const dateKey = new Hash(dateUnix).md5;
        aggData[dateKey].marketCap = data;
      });
      result?.total_volumes.forEach(([dateValue, data]) => {
        const dateUnix = new FormatDate(dateValue).unix;
        const dateKey = new Hash(dateUnix).md5;
        aggData[dateKey].volume = data;
      });
      return aggData
    }
    return result
  }
}

/**
 *
 * @param {*} tokenASymbol
 * @param {*} tokenBSymbol
 * @param {*} tokenAId
 * @param {*} tokenBID
 * @param {*} from
 * @param {*} to
 */
function updateHistory(
  from,
  to,
  tokenASymbol,
  tokenBSymbol,
  tokenAId,
  tokenBID
) {
  let dateFrom, fromUnix, countDay;
  const histories = new Analitics().getWorkSheet('history');
  dateFrom = new FormatDate(from);
  const dateTo = new FormatDate(to);
  fromUnix = dateFrom.unix;
  const toUnix = dateTo.unix;
  countDay = dateFrom.diffBetweenDate(dateTo.date) + 1;

  if (countDay < 91) {
    countDay = 91;
    dateFrom = new FormatDate(dateTo.date).getPreviousDate(countDay);
    fromUnix = dateFrom.unix;
  }

  const object = {};
  const tokenAData = Object.values(
    new Coins().getCoinsRange(tokenAId, 'usd', fromUnix, toUnix)
  );

  // const tokenAData = new cryptoCompare.Historical().histoday(
  //   tokenASymbol,
  //   'usdt',
  //   countDay,
  //   toUnix
  // )

  // const tokenAMarketCap = new coinGecko.Coins().getCoinsRange(
  //   tokenAId,
  //   'usd',
  //   fromUnix,
  //   toUnix
  // )

  const tokenBData = Object.values(
    new Coins().getCoinsRange(tokenBID, 'usd', fromUnix, toUnix)
  );

  // const tokenBData = new cryptoCompare.Historical().histoday(
  //   tokenBSymbol,
  //   'usdt',
  //   countDay,
  //   toUnix
  // )

  // const tokenBMarketCap = new coinGecko.Coins().getCoinsRange(
  //   tokenBID,
  //   'usd',
  //   fromUnix,
  //   toUnix
  // )

  tokenAData.forEach((rowObject) => {
    const dataKey = new Hash(rowObject.dateUnix).md5;
    if (!object[dataKey]) {
      object[dataKey] = {
        dateKey: dataKey,
        date: new FormatDate(new Date(rowObject.dateUnix * 1000)).getFormatDate(
          'yyyy-MM-dd'
        ),
        dateUnix: rowObject.dateUnix,
        tokenATokenB: tokenASymbol + '/' + tokenBSymbol,
        tokenBPrice: void 0,
        tokenAPrice: rowObject.price,
        coefPrice: void 0,
        lrCoefPrice: void 0,
        tokenAMarketCap: rowObject.marketCap,
        tokenBMarketCap: rowObject.marketCap,
        coefPriceMarketCap: void 0,
        tokenBVolume: void 0,
        tokenAVolume: rowObject.volume,
        coefVolume: void 0,
        lrCoefVolume: void 0,
      };
    }
  });

  tokenBData.forEach((rowObject) => {
    const dataKey = new Hash(rowObject.dateUnix).md5;
    object[dataKey].tokenBPrice = rowObject.price;
    object[dataKey].tokenBVolume = rowObject.volume;
    object[dataKey].tokenBMarketCap = rowObject.marketCap;
  });
  const filterArrayOfObject = Object.values(object).filter((rowObject) => {
    return (
      rowObject.tokenAPrice &&
      rowObject.tokenBPrice &&
      rowObject.tokenAMarketCap &&
      rowObject.tokenBMarketCap &&
      rowObject.tokenAVolume &&
      rowObject.tokenBVolume &&
      rowObject.dateUnix > new FormatDate(from).unix
    )
  });
  histories.truncateInsertRows(filterArrayOfObject);
}

function calculateCoef() {
  let times, coefPrices, coefVolumes, coefMarketCaps, coefVolatilitys;
  times = [];
  coefPrices = [];
  coefVolumes = [];
  coefMarketCaps = [];
  coefVolatilitys = [];
  const histories = new Analitics().getWorkSheet('history');
  const newHistories = histories.arrayOfObject.reduce((object, rowObject) => {
    if (!object[rowObject.dateKey]) {
      object[rowObject.dateKey] = rowObject;
    }
    object[rowObject.dateKey].coefPrice =
      rowObject.tokenAPrice / rowObject.tokenBPrice;
    object[rowObject.dateKey].coefVolume =
      rowObject.tokenAVolume / rowObject.tokenBVolume;
    object[rowObject.dateKey].coefPriceMarketCap =
      rowObject.tokenAMarketCap / rowObject.tokenBMarketCap;

    //* расчет волантильности
    object[rowObject.dateKey].tokenAVolatility =
      rowObject.tokenAVolume / rowObject.tokenAMarketCap;
    object[rowObject.dateKey].tokenBVolatility =
      rowObject.tokenBVolume / rowObject.tokenBMarketCap;
    object[rowObject.dateKey].coefVolatility =
      object[rowObject.dateKey].tokenAVolatility /
      object[rowObject.dateKey].tokenBVolatility;
    times.push(rowObject.dateUnix);
    coefPrices.push(object[rowObject.dateKey].coefPrice);
    coefVolumes.push(object[rowObject.dateKey].coefVolume);
    coefMarketCaps.push(object[rowObject.dateKey].coefPriceMarketCap);
    coefVolatilitys.push(object[rowObject.dateKey].coefVolatility);
    return object
  }, {});

  //* расчет коэфициента цены
  const positiveArraydiffCoefPricestoLr = [];
  const negativeArraydiffCoefPricestoLr = [];
  const arraylrCoefPrices = [];
  const lrCoefPrices = findLineByLeastSquares(times, coefPrices);
  lrCoefPrices.forEach(([time, value]) => {
    const dateKey = new Hash(time).md5;
    newHistories[dateKey].lrCoefPrice = value;
    arraylrCoefPrices.push(value);
    //* расчет отклонения от средней регресионной
    newHistories[dateKey].diffCoefPricestoLr =
      newHistories[dateKey].coefPrice - value;
    if (newHistories[dateKey].diffCoefPricestoLr > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr.push(
        newHistories[dateKey].diffCoefPricestoLr
      );
    } else if (newHistories[dateKey].diffCoefPricestoLr < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr.push(
        newHistories[dateKey].diffCoefPricestoLr * -1
      );
    }
  });

  // const maxPositiveArraydiffCoefPricestoLr = positiveArraydiffCoefPricestoLr.reduce(
  //   (max, value) => {
  //     if (max < value) {
  //       max = value
  //     }
  //     return max
  //   },
  //   0
  // )
  // const minPositiveArraydiffCoefPricestoLr = positiveArraydiffCoefPricestoLr.reduce(
  //   (min, value) => {
  //     if (min > value) {
  //       min = value
  //     }
  //     return min
  //   },
  //   maxPositiveArraydiffCoefPricestoLr
  // )

  const stdevPositiveArraydiffCoefPricestoLr = getStandardDeviation(
    positiveArraydiffCoefPricestoLr
  );

  const varPositiveArraydiffCoefPricestoLr = calculateVariance(
    positiveArraydiffCoefPricestoLr
  );

  // console.log(
  //   'positiveArraydiffCoefPricestoLr',
  //   positiveArraydiffCoefPricestoLr
  // )

  // console.log(
  //   'maxPositiveArraydiffCoefPricestoLr',
  //   maxPositiveArraydiffCoefPricestoLr
  // )
  // console.log(
  //   'minPositiveArraydiffCoefPricestoLr',
  //   minPositiveArraydiffCoefPricestoLr
  // )
  // console.log(
  //   'stdevPositiveArraydiffCoefPricestoLr',
  //   stdevPositiveArraydiffCoefPricestoLr
  // )

  // console.log(
  //   'varPositiveArraydiffCoefPricestoLr',
  //   varPositiveArraydiffCoefPricestoLr
  // )

  const stdevNegativeArraydiffCoefPricestoLr = getStandardDeviation(
    negativeArraydiffCoefPricestoLr
  );

  const varNegativeArraydiffCoefPricestoLr = calculateVariance(
    negativeArraydiffCoefPricestoLr
  );

  //* расчет коэфициента объема
  const lrCoefVolumes = findLineByLeastSquares(times, coefVolumes);
  lrCoefVolumes.forEach(([time, value]) => {
    const dateKey = new Hash(time).md5;
    newHistories[dateKey].lrCoefVolume = value;
  });
  //* расчет коэфициента капитализации
  const lrcoefPriceMarketCaps = findLineByLeastSquares(times, coefMarketCaps);
  lrcoefPriceMarketCaps.forEach(([time, value]) => {
    const dateKey = new Hash(time).md5;
    newHistories[dateKey].lrCoefPriceMarketCap = value;
  });
  //* расчет коэфициента волантильности
  const lrCoefVolatilitys = findLineByLeastSquares(times, coefVolatilitys);
  lrCoefVolatilitys.forEach(([time, value]) => {
    const dateKey = new Hash(time).md5;
    newHistories[dateKey].lrCoefVolatility = value;
  });

  // arrayOfObject = Object.values(newHistories)
  // const arrayCoefPrices = arrayOfObject.map((m) => m.lrCoefPrice)
  // const arrayCoefVolumes = arrayOfObject.map((m) => m.lrCoefVolume)
  // const arrayCoefMarketCap = arrayOfObject.map((m) => m.lrCoefPriceMarketCap)
  // const arrayCoefVolatility = arrayOfObject.map((m) => m.lrCoefVolatility)
  // const lrFormula1 = linearRegression(arrayCoefPrices, arrayCoefVolumes)
  // const lrFormula2 = linearRegression(arrayCoefPrices, arrayCoefMarketCap)
  // const lrFormula3 = linearRegression(arrayCoefPrices, arrayCoefVolatility)
  // const lrFormula4 = linearRegression(arrayCoefMarketCap, arrayCoefVolumes)
  // const lrFormula5 = linearRegression(arrayCoefMarketCap, arrayCoefVolatility)
  // const lrFormula6 = linearRegression(arrayCoefVolumes, arrayCoefVolatility)
  // console.log('linearRegression(arrayCoefPrices, arrayCoefVolumes)', lrFormula1)
  // console.log(
  //   'linearRegression(arrayCoefPrices, arrayCoefMarketCap)',
  //   lrFormula2
  // )
  // console.log(
  //   'linearRegression(arrayCoefPrices, arrayCoefVolatility)',
  //   lrFormula3
  // )
  // console.log(
  //   'linearRegression(arrayCoefMarketCap, arrayCoefVolumes)',
  //   lrFormula4
  // )
  // console.log(
  //   'linearRegression(arrayCoefMarketCap, arrayCoefVolatility)',
  //   lrFormula5
  // )
  // console.log(
  //   'linearRegression(arrayCoefVolumes, arrayCoefVolatility)',
  //   lrFormula6
  // )
  const arrayOfObjectNewHistories = Object.values(newHistories);
  arrayOfObjectNewHistories.forEach((rowObject) => {
    rowObject.lrCoefPriceHigh =
      rowObject.lrCoefPrice +
      (stdevPositiveArraydiffCoefPricestoLr -
        varPositiveArraydiffCoefPricestoLr) *
        2;
    rowObject.stdevPositiveArraydiffCoefPricestoLr = stdevPositiveArraydiffCoefPricestoLr;
    rowObject.varPositiveArraydiffCoefPricestoLr = varPositiveArraydiffCoefPricestoLr;
    rowObject.lrCoefPriceLow =
      rowObject.lrCoefPrice -
      (stdevNegativeArraydiffCoefPricestoLr -
        varNegativeArraydiffCoefPricestoLr) *
        2;

    rowObject.stdevNegativeArraydiffCoefPricestoLr = stdevNegativeArraydiffCoefPricestoLr;
    rowObject.varNegativeArraydiffCoefPricestoLr = varNegativeArraydiffCoefPricestoLr;
  });

  histories.truncateInsertRows(Object.values(arrayOfObjectNewHistories));
}

function getStandardDeviation(array) {
  const n = array.length;
  const mean = array.reduce((a, b) => a + b) / n;
  return Math.sqrt(
    array.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n
  )
}

/**
 *  y = slope * x + intercept
 * @param {array} y
 * @param {array} x
 * @returns slope  , intercept , r2
 */
function linearRegression(y, x) {
  /*y = slope * x + intercept */
  var lr = { slope: void 0, intercept: void 0, r2: void 0 };
  var n = y.length;
  var sum_x = 0;
  var sum_y = 0;
  var sum_xy = 0;
  var sum_xx = 0;
  var sum_yy = 0;

  for (var i = 0; i < y.length; i++) {
    sum_x += x[i];
    sum_y += y[i];
    sum_xy += x[i] * y[i];
    sum_xx += x[i] * x[i];
    sum_yy += y[i] * y[i];
  }

  lr['slope'] = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
  lr['intercept'] = (sum_y - lr.slope * sum_x) / n;
  lr['r2'] = Math.pow(
    (n * sum_xy - sum_x * sum_y) /
      Math.sqrt((n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y)),
    2
  );

  return lr
}

function findLineByLeastSquares(values_x, values_y) {
  var sum_x = 0;
  var sum_y = 0;
  var sum_xy = 0;
  var sum_xx = 0;
  var count = 0;

  /*
   * We'll use those variables for faster read/write access.
   */
  var x = 0;
  var y = 0;
  var values_length = values_x.length;

  if (values_length != values_y.length) {
    throw new Error(
      'The parameters values_x and values_y need to have same size!'
    )
  }

  /*
   * Nothing to do.
   */
  if (values_length === 0) {
    return [[], []]
  }

  /*
   * Calculate the sum for each of the parts necessary.
   */
  for (var v = 0; v < values_length; v++) {
    x = values_x[v];
    y = values_y[v];
    sum_x += x;
    sum_y += y;
    sum_xx += x * x;
    sum_xy += x * y;
    count++;
  }

  /*
   * Calculate m and b for the formular:
   * y = x * m + b
   */
  var m = (count * sum_xy - sum_x * sum_y) / (count * sum_xx - sum_x * sum_x);
  var b = sum_y / count - (m * sum_x) / count;

  /*
   * We will make the x and y result line now
   */
  // var result_values_x = []
  // var result_values_y = []
  const arrayOfArray = [];

  for (var v = 0; v < values_length; v++) {
    x = values_x[v];
    y = x * m + b;
    arrayOfArray.push([x, y]);
    // result_values_x.push(x)
    // result_values_y.push(y)
  }

  // return [result_values_x, result_values_y]
  return arrayOfArray
}

function median(numbers) {
  const sorted = Array.from(numbers).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function quickselect_median(arr) {
  const L = arr.length,
    halfL = L / 2;
  if (L % 2 == 1) return quickselect(arr, halfL)
  else return 0.5 * (quickselect(arr, halfL - 1) + quickselect(arr, halfL))
}

function quickselect(arr, k) {
  // Select the kth element in arr
  // arr: List of numerics
  // k: Index
  // return: The kth element (in numerical order) of arr
  if (arr.length == 1) return arr[0]
  else {
    const pivot = arr[0];
    const lows = arr.filter((e) => e < pivot);
    const highs = arr.filter((e) => e > pivot);
    const pivots = arr.filter((e) => e == pivot);
    if (k < lows.length)
      // the pivot is too high
      return quickselect(lows, k)
    else if (k < lows.length + pivots.length)
      // We got lucky and guessed the median
      return pivot
    // the pivot is too low
    else return quickselect(highs, k - lows.length - pivots.length)
  }
}

// Calculate the average of all the numbers
const calculateMean = (values) => {
  const mean = values.reduce((sum, current) => sum + current) / values.length;
  return mean
};

// Calculate variance
const calculateVariance = (values) => {
  const average = calculateMean(values);
  const squareDiffs = values.map((value) => {
    const diff = value - average;
    return diff * diff
  });
  const variance = calculateMean(squareDiffs);
  return variance
};
