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
   * @param {object} options Часовой пояс и признак Timestamp. По умолчанию - GMT+3 , Timestamp = true
   */
  constructor(date = new Date(), timeZone = 'GMT+3') {
    this.date = new Date(date);
    this.timeZone = timeZone;
  }

  getDateBegin() {
    this.date = new Date(
      this.date.getFullYear(),
      this.date.getMonth(),
      this.date.getDate(),
      0,
      0,
      0,
      0
    );
    return this
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
    return Math.round(this.date.valueOf() / 1000)
  }

  get value() {
    return new Date(this.date).valueOf()
  }

  get dateKey() {
    return new Hash(this.value).md5
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
    const enddt = new FormatDate(endDate).getDateBegin().date;
    if (new Date(strtdt).getFullYear() > 2000) {
      const diff = Math.round(
        (enddt.getTime() - strtdt.getTime()) / (24 * 3600 * 1000)
      );
      return isNaN(diff) ? 0 : diff
    } else {
      return 0
    }
  }

  getListDates(endDate = new Date()) {
    const enddt = new FormatDate(endDate).date;
    const countDay = this.diffBetweenDate(enddt) + 1;
    this.listDates = [...Array(countDay).keys()].map(
      (m) =>
        (new FormatDate(
          new Date(enddt.setDate(enddt.getDate() - 1))
        ).getDateBegin().date)
    );
    return this
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

Date.prototype.getDateBeginUTC = function () {
  const sourceDate = new Date(this);
  const tmzn = 'UTC';
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
                    value = new FormatDate(
                      this.head[column].default
                    ).getFormatDate('yyyy-MM-dd HH:mm');
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
            value[column] = new FormatDate(
              this.head[column].default
            ).getFormatDate('yyyy-MM-dd HH:mm');
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
                    value = new FormatDate(
                      this.head[column].default
                    ).getFormatDate('yyyy-MM-dd HH:mm');
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
                value = new FormatDate(this.head[column].default).getFormatDate(
                  'yyyy-MM-dd HH:mm'
                );
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
          dateValue: { alias: 'dateValue', idx: 3 },
          tokenATokenB: { alias: 'tokenATokenB', idx: 4 },
          tokenATokenBKey: { alias: 'tokenATokenBKey', idx: 5 },
          tokenAPrice: { alias: 'tokenAPrice', idx: 6 },
          tokenBPrice: { alias: 'tokenBPrice', idx: 7 },
          coefPrice: { alias: 'coefPrice', idx: 8 },
          coefPriceAth: { alias: 'coefPriceAth', idx: 9 },
          coefPriceAtl: { alias: 'coefPriceAtl', idx: 10 },
          lrCoefPrice: { alias: 'lrCoefPrice', idx: 11 },
          lrCoefPriceHigh: { alias: 'lrCoefPriceHigh', idx: 12 },
          lrCoefPriceLow: { alias: 'lrCoefPriceLow', idx: 13 },
          // lrCoefPrice3d: { alias: 'lrCoefPrice3d', idx: 14 },
          // lrCoefPriceHigh3d: { alias: 'lrCoefPriceHigh3d', idx: 15 },
          // lrCoefPriceLow3d: { alias: 'lrCoefPriceLow3d', idx: 16 },
          // lrCoefPrice7d: { alias: 'lrCoefPrice7d', idx: 17 },
          // lrCoefPriceHigh7d: { alias: 'lrCoefPriceHigh7d', idx: 18 },
          // lrCoefPriceLow7d: { alias: 'lrCoefPriceLow7d', idx: 19 },

          lrCoefPrice30d: { alias: 'lrCoefPrice30d', idx: 14 },
          lrCoefPriceHigh30d: { alias: 'lrCoefPriceHigh30d', idx: 15 },
          lrCoefPriceLow30d: { alias: 'lrCoefPriceLow30d', idx: 16 },
          lrCoefPrice60d: { alias: 'lrCoefPrice60d', idx: 17 },
          lrCoefPriceHigh60d: { alias: 'lrCoefPriceHigh60d', idx: 18 },
          lrCoefPriceLow60d: { alias: 'lrCoefPriceLow60d', idx: 19 },
          lrCoefPrice90d: { alias: 'lrCoefPrice90d', idx: 20 },
          lrCoefPriceHigh90d: { alias: 'lrCoefPriceHigh90d', idx: 21 },
          lrCoefPriceLow90d: { alias: 'lrCoefPriceLow90d', idx: 22 },
          // stdevPositiveArraydiffCoefPricestoLr: {
          //   alias: 'stdevPositiveArraydiffCoefPricestoLr',
          //   idx: 10,
          // },
          // varPositiveArraydiffCoefPricestoLr: {
          //   alias: 'varPositiveArraydiffCoefPricestoLr',
          //   idx: 11,
          // },
          // avgPositiveArraydiffCoefPricestoLr: {
          //   alias: 'avgPositiveArraydiffCoefPricestoLr',
          //   idx: 12,
          // },
          // coefVarPositiveArraydiffCoefPricestoLr: {
          //   alias: 'coefVarPositiveArraydiffCoefPricestoLr',
          //   idx: 13,
          // },
          // stdevNegativeArraydiffCoefPricestoLr: {
          //   alias: 'stdevNegativeArraydiffCoefPricestoLr',
          //   idx: 14,
          // },
          // varNegativeArraydiffCoefPricestoLr: {
          //   alias: 'varNegativeArraydiffCoefPricestoLr',
          //   idx: 15,
          // },
          // avgNegativeArraydiffCoefPricestoLr: {
          //   alias: 'avgNegativeArraydiffCoefPricestoLr',
          //   idx: 16,
          // },
          // coefVarNegativeArraydiffCoefPricestoLr: {
          //   alias: 'coefVarNegativeArraydiffCoefPricestoLr',
          //   idx: 17,
          // },
          // tokenAMarketCap: { alias: 'tokenAMarketCap', idx: 18 },
          // tokenBMarketCap: { alias: 'tokenBMarketCap', idx: 19 },
          // coefPriceMarketCap: { alias: 'coefPriceMarketCap', idx: 20 },
          // lrCoefPriceMarketCap: { alias: 'lrCoefPriceMarketCap', idx: 21 },
          // tokenAVolume: { alias: 'tokenAVolume', idx: 22 },
          // tokenBVolume: { alias: 'tokenBVolume', idx: 23 },
          // coefVolume: { alias: 'coefVolume', idx: 24 },
          // lrCoefVolume: { alias: 'lrCoefVolume', idx: 25 },
          // tokenAVolatility: { alias: 'tokenAVolatility', idx: 26 },
          // tokenBVolatility: { alias: 'tokenBVolatility', idx: 27 },
          // coefVolatility: { alias: 'coefVolatility', idx: 28 },
          // lrCoefVolatility: { alias: 'lrCoefVolatility', idx: 29 },
          rowId: { alias: 'Row ID', idx: 25 },
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
        const dateData = new FormatDate(dateValue).getDateBegin();
        const dateKey = dateData.dateKey;
        if (!object[dateKey]) {
          object[dateKey] = {
            dateKey: dateKey,
            dateString: dateData.date,
            dateUnix: dateData.unix,
            dateValue: dateData.value,
            timeZone: dateData.timeZone,
            price: data,
            marketCap: void 0,
            volume: void 0,
          };
        }
        return object
      }, {});
      result?.market_caps.forEach(([dateValue, data]) => {
        const dateKey = new FormatDate(dateValue).getDateBegin().dateKey;
        aggData[dateKey].marketCap = data;
      });
      result?.total_volumes.forEach(([dateValue, data]) => {
        const dateKey = new FormatDate(dateValue).getDateBegin().dateKey;
        aggData[dateKey].volume = data;
      });
      return aggData
    }
    return result
  }
}

/**
 *
 * @param {*} from
 * @param {*} to
 * @param {*} tokenAId
 * @param {*} tokenBId
 */
function updateHistory(from, to, tokenAId, tokenBId) {
  let dateFrom, fromUnix, countDay;
  const histories = new Analitics().getWorkSheet('history');
  const tokenATokenBData = new Hash(tokenAId + '/' + tokenBId);
  const historiesOldData = new Analitics()
    .getWorkSheet('history')
    .arrayOfObject.filter((rowObject) => {
      return rowObject.tokenATokenBKey !== tokenATokenBData.md5
    });
  dateFrom = new FormatDate(from).getDateBegin();
  const dateTo = to
    ? new FormatDate(to).getDateBegin()
    : new FormatDate(new Date()).getDateBegin();

  fromUnix = dateFrom.unix;
  const toUnix = dateTo.unix;
  countDay = dateFrom.diffBetweenDate(dateTo.date) + 1;

  if (countDay < 91) {
    countDay = 91;
    dateFrom = new FormatDate(dateTo.date)
      .getDateBegin()
      .getPreviousDate(countDay);
    fromUnix = dateFrom.unix;
  }

  const tokenAData = new Coins().getCoinsRange(
    tokenAId,
    'usd',
    fromUnix,
    toUnix
  );

  const tokenBData = new Coins().getCoinsRange(
    tokenBId,
    'usd',
    fromUnix,
    toUnix
  );

  const allData = new FormatDate(dateFrom.date)
    .getListDates(dateTo.date)
    .listDates.reduce((rowObject, date) => {
      const dateData = new FormatDate(date).getDateBegin();
      const dateKey = dateData.dateKey;
      if (!rowObject[dateKey]) {
        rowObject[dateKey] = {
          dateKey: dateKey,
          dateString: dateData.date,
          dateValue: dateData.value,
          dateUnix: dateData.unix,
          date: dateData.getFormatDate('yyyy-MM-dd'),
          tokenATokenB: tokenATokenBData.stringLowerCase,
          tokenATokenBKey: tokenATokenBData.md5,
          tokenAPrice: tokenAData[dateKey]?.price,
          tokenBPrice: tokenBData[dateKey]?.price,
          coefPrice: tokenAData[dateKey]?.price / tokenBData[dateKey]?.price,
          lrCoefPrice: void 0,
          tokenAMarketCap: tokenAData[dateKey]?.marketCap,
          tokenBMarketCap: tokenBData[dateKey]?.marketCap,
          coefPriceMarketCap:
            tokenAData[dateKey]?.marketCap / tokenBData[dateKey]?.marketCap,
          tokenAVolume: tokenAData[dateKey]?.volume,
          tokenBVolume: tokenBData[dateKey]?.volume,
          coefVolume: tokenAData[dateKey]?.volume / tokenBData[dateKey]?.volume,
          lrCoefVolume: void 0,
        };
      }
      return rowObject
    }, {});

  const filterArrayOfObject = Object.values(allData).filter((rowObject) => {
    return (
      rowObject.tokenAPrice &&
      rowObject.tokenBPrice &&
      rowObject.tokenAMarketCap &&
      rowObject.tokenBMarketCap &&
      rowObject.tokenAVolume &&
      rowObject.tokenBVolume
    )
  });

  histories.truncateInsertRows([...historiesOldData, ...filterArrayOfObject]);
}
/**
 *
 * @param {*} fromMetric yyyy-mm-dd
 * @param {*} toMetric yyyy-mm-dd
 * @param {*} tokenAId
 * @param {*} tokenBId
 */
function calculateCoef(fromMetric, toMetric, tokenAId, tokenBId) {
  let dateUnixs,
    coefPrices,
    // dateUnixs3d,
    // coefPrices3d,
    // dateUnixs7d,
    // coefPrices7d,
    dateUnixs30d,
    coefPrices30d,
    dateUnixs60d,
    coefPrices60d,
    dateUnixs90d,
    coefPrices90d,
    dateToMetric0dUnix,
    // dateFromMetric3dUnix,
    // dateFromMetric7dUnix,
    dateFromMetric30dUnix,
    dateFromMetric60dUnix,
    dateFromMetric90dUnix;
  //  coefVolumes, coefMarketCaps, coefVolatilitys
  dateUnixs = [];
  coefPrices = [];
  // dateUnixs3d = []
  // coefPrices3d = []
  // dateUnixs7d = []
  // coefPrices7d = []
  dateUnixs30d = [];
  coefPrices30d = [];
  dateUnixs60d = [];
  coefPrices60d = [];
  dateUnixs90d = [];
  coefPrices90d = [];
  // coefPrices = []
  // coefVolumes = []
  // coefMarketCaps = []
  // coefVolatilitys = []

  const dateFromMetric = new FormatDate(fromMetric).getDateBegin();
  const dateToMetric = new FormatDate(toMetric).getDateBegin();
  const tokenATokenBData = new Hash(tokenAId + '/' + tokenBId);

  const histories = new Analitics().getWorkSheet('history');
  const historiesOldData =
    histories.arrayOfObject.filter((rowObject) => {
      return rowObject.tokenATokenBKey !== tokenATokenBData.md5
    }) || [];

  const historiesPair =
    histories.arrayOfObject.filter((rowObject) => {
      return rowObject.tokenATokenBKey === tokenATokenBData.md5
    }) || [];

  dateToMetric0dUnix = historiesPair.reduce((max, rowObject) => {
    if (max < rowObject.dateUnix) {
      max = rowObject.dateUnix;
    }
    return max
  }, 0);

  // dateFromMetric3dUnix = new FormatDate(
  //   dateToMetric0dUnix * 1000
  // ).getPreviousDate(3).unix
  // dateFromMetric7dUnix = new FormatDate(
  //   dateToMetric0dUnix * 1000
  // ).getPreviousDate(7).unix
  dateFromMetric30dUnix = new FormatDate(
    dateToMetric0dUnix * 1000
  ).getPreviousDate(30).unix;
  dateFromMetric60dUnix = new FormatDate(
    dateToMetric0dUnix * 1000
  ).getPreviousDate(60).unix;
  dateFromMetric90dUnix = new FormatDate(
    dateToMetric0dUnix * 1000
  ).getPreviousDate(90).unix;

  const historiesPairNew = historiesPair.reduce((object, rowObject) => {
    if (!object[rowObject.dateKey]) {
      object[rowObject.dateKey] = rowObject;
    }

    // //* расчет волантильности
    // object[rowObject.dateKey].tokenAVolatility =
    //   rowObject.tokenAVolume / rowObject.tokenAMarketCap
    // object[rowObject.dateKey].tokenBVolatility =
    //   rowObject.tokenBVolume / rowObject.tokenBMarketCap
    // object[rowObject.dateKey].coefVolatility =
    //   object[rowObject.dateKey].tokenAVolatility /
    //   object[rowObject.dateKey].tokenBVolatility
    //* ограничение по входным параметрам
    if (
      rowObject.dateUnix >= dateFromMetric.unix &&
      rowObject.dateUnix <= dateToMetric.unix
    ) {
      dateUnixs.push(rowObject.dateUnix);
      coefPrices.push(object[rowObject.dateKey].coefPrice);
      // coefVolumes.push(object[rowObject.dateKey].coefVolume)
      // coefMarketCaps.push(object[rowObject.dateKey].coefPriceMarketCap)
      // coefVolatilitys.push(object[rowObject.dateKey].coefVolatility)
    }
    // //* за три последний дня
    // if (
    //   rowObject.dateUnix >= dateFromMetric3dUnix &&
    //   rowObject.dateUnix <= dateToMetric0dUnix
    // ) {
    //   dateUnixs3d.push(rowObject.dateUnix)
    //   coefPrices3d.push(object[rowObject.dateKey].coefPrice)
    // }
    // //* за 7 дней
    // if (
    //   rowObject.dateUnix >= dateFromMetric7dUnix &&
    //   rowObject.dateUnix <= dateToMetric0dUnix
    // ) {
    //   dateUnixs7d.push(rowObject.dateUnix)
    //   coefPrices7d.push(object[rowObject.dateKey].coefPrice)
    // }
    //* за 30 дней
    if (
      rowObject.dateUnix >= dateFromMetric30dUnix &&
      rowObject.dateUnix <= dateToMetric0dUnix
    ) {
      dateUnixs30d.push(rowObject.dateUnix);
      coefPrices30d.push(object[rowObject.dateKey].coefPrice);
    }
    //* за 60 дней
    if (
      rowObject.dateUnix >= dateFromMetric60dUnix &&
      rowObject.dateUnix <= dateToMetric0dUnix
    ) {
      dateUnixs60d.push(rowObject.dateUnix);
      coefPrices60d.push(object[rowObject.dateKey].coefPrice);
    }
    //* за 90 дней
    if (
      rowObject.dateUnix >= dateFromMetric90dUnix &&
      rowObject.dateUnix <= dateToMetric0dUnix
    ) {
      dateUnixs90d.push(rowObject.dateUnix);
      coefPrices90d.push(object[rowObject.dateKey].coefPrice);
    }
    return object
  }, {});

  //* расчет коэфициента цены
  let positiveArraydiffCoefPricestoLr,
    // positiveArraydiffCoefPricestoLr3d,
    // positiveArraydiffCoefPricestoLr7d,
    positiveArraydiffCoefPricestoLr30d,
    positiveArraydiffCoefPricestoLr60d,
    positiveArraydiffCoefPricestoLr90d;
  positiveArraydiffCoefPricestoLr = [];
  // positiveArraydiffCoefPricestoLr3d = []
  // positiveArraydiffCoefPricestoLr7d = []
  positiveArraydiffCoefPricestoLr30d = [];
  positiveArraydiffCoefPricestoLr60d = [];
  positiveArraydiffCoefPricestoLr90d = [];
  let negativeArraydiffCoefPricestoLr,
    // negativeArraydiffCoefPricestoLr3d,
    // negativeArraydiffCoefPricestoLr7d,
    negativeArraydiffCoefPricestoLr30d,
    negativeArraydiffCoefPricestoLr60d,
    negativeArraydiffCoefPricestoLr90d;
  negativeArraydiffCoefPricestoLr = [];
  // negativeArraydiffCoefPricestoLr3d = []
  // negativeArraydiffCoefPricestoLr7d = []
  negativeArraydiffCoefPricestoLr30d = [];
  negativeArraydiffCoefPricestoLr60d = [];
  negativeArraydiffCoefPricestoLr90d = [];

  let lrCoefPrices,
    // lrCoefPrices3d,
    // lrCoefPrices7d,
    lrCoefPrices30d,
    lrCoefPrices60d,
    lrCoefPrices90d;

  lrCoefPrices = findLineByLeastSquares(dateUnixs, coefPrices);
  // lrCoefPrices3d = findLineByLeastSquares(dateUnixs3d, coefPrices3d)
  // lrCoefPrices7d = findLineByLeastSquares(dateUnixs7d, coefPrices7d)
  lrCoefPrices30d = findLineByLeastSquares(dateUnixs30d, coefPrices30d);
  lrCoefPrices60d = findLineByLeastSquares(dateUnixs60d, coefPrices60d);
  lrCoefPrices90d = findLineByLeastSquares(dateUnixs90d, coefPrices90d);

  let coefPriceAthArray, coefPriceAtlArray;

  coefPriceAthArray = [];
  coefPriceAtlArray = [];

  lrCoefPrices.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey;
    historiesPairNew[dateKey].lrCoefPrice = value;
    //* расчет отклонения от средней регресионной
    historiesPairNew[dateKey].diffCoefPricestoLr =
      historiesPairNew[dateKey].coefPrice - value;
    if (historiesPairNew[dateKey].diffCoefPricestoLr > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr.push(
        historiesPairNew[dateKey].diffCoefPricestoLr
      );
      coefPriceAthArray.push({
        dateKey: dateKey,
        diffCoefPricestoLr: historiesPairNew[dateKey].diffCoefPricestoLr,
        coefPrice: historiesPairNew[dateKey].coefPrice,
      });
    } else if (historiesPairNew[dateKey].diffCoefPricestoLr < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr.push(
        historiesPairNew[dateKey].diffCoefPricestoLr * -1
      );
      coefPriceAtlArray.push({
        dateKey: dateKey,
        diffCoefPricestoLr: historiesPairNew[dateKey].diffCoefPricestoLr * -1,
        coefPrice: historiesPairNew[dateKey].coefPrice,
      });
    }
  });

  //* Максимум и минимум коэффициенты
  let coefPriceAth;
  coefPriceAth = { dateKey: void 0, diffCoefPricestoLr: 0 };
  coefPriceAthArray.forEach((object) => {
    if (object.diffCoefPricestoLr > coefPriceAth.diffCoefPricestoLr) {
      coefPriceAth = object;
    }
  });

  let coefPriceAtl;
  coefPriceAtl = { dateKey: void 0, diffCoefPricestoLr: 0 };
  coefPriceAtlArray.forEach((object) => {
    if (object.diffCoefPricestoLr > coefPriceAtl.diffCoefPricestoLr) {
      coefPriceAtl = object;
    }
  });

  // lrCoefPrices3d.forEach(([dateUnix, value]) => {
  //   const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
  //     .dateKey
  //   historiesPairNew[dateKey].lrCoefPrice3d = value
  //   // arraylrCoefPrices.push(value)
  //   //* расчет отклонения от средней регресионной
  //   historiesPairNew[dateKey].diffCoefPricestoLr3d =
  //     historiesPairNew[dateKey].coefPrice - value
  //   if (historiesPairNew[dateKey].diffCoefPricestoLr3d > 0) {
  //     //* положительное отклонение
  //     positiveArraydiffCoefPricestoLr3d.push(
  //       historiesPairNew[dateKey].diffCoefPricestoLr3d
  //     )
  //   } else if (historiesPairNew[dateKey].diffCoefPricestoLr3d < 0) {
  //     //* отрицательное отклонение
  //     negativeArraydiffCoefPricestoLr3d.push(
  //       historiesPairNew[dateKey].diffCoefPricestoLr3d * -1
  //     )
  //   }
  // })

  // lrCoefPrices7d.forEach(([dateUnix, value]) => {
  //   const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
  //     .dateKey
  //   historiesPairNew[dateKey].lrCoefPrice7d = value
  //   // arraylrCoefPrices.push(value)
  //   //* расчет отклонения от средней регресионной
  //   historiesPairNew[dateKey].diffCoefPricestoLr7d =
  //     historiesPairNew[dateKey].coefPrice - value
  //   if (historiesPairNew[dateKey].diffCoefPricestoLr7d > 0) {
  //     //* положительное отклонение
  //     positiveArraydiffCoefPricestoLr7d.push(
  //       historiesPairNew[dateKey].diffCoefPricestoLr7d
  //     )
  //   } else if (historiesPairNew[dateKey].diffCoefPricestoLr7d < 0) {
  //     //* отрицательное отклонение
  //     negativeArraydiffCoefPricestoLr7d.push(
  //       historiesPairNew[dateKey].diffCoefPricestoLr7d * -1
  //     )
  //   }
  // })

  lrCoefPrices30d.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey;
    historiesPairNew[dateKey].lrCoefPrice30d = value;
    // arraylrCoefPrices.push(value)
    //* расчет отклонения от средней регресионной
    historiesPairNew[dateKey].diffCoefPricestoLr30d =
      historiesPairNew[dateKey].coefPrice - value;
    if (historiesPairNew[dateKey].diffCoefPricestoLr30d > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr30d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr30d
      );
    } else if (historiesPairNew[dateKey].diffCoefPricestoLr30d < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr30d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr30d * -1
      );
    }
  });

  lrCoefPrices60d.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey;
    historiesPairNew[dateKey].lrCoefPrice60d = value;
    // arraylrCoefPrices.push(value)
    //* расчет отклонения от средней регресионной
    historiesPairNew[dateKey].diffCoefPricestoLr60d =
      historiesPairNew[dateKey].coefPrice - value;
    if (historiesPairNew[dateKey].diffCoefPricestoLr60d > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr60d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr60d
      );
    } else if (historiesPairNew[dateKey].diffCoefPricestoLr60d < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr60d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr60d * -1
      );
    }
  });

  lrCoefPrices90d.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey;
    historiesPairNew[dateKey].lrCoefPrice90d = value;
    // arraylrCoefPrices.push(value)
    //* расчет отклонения от средней регресионной
    historiesPairNew[dateKey].diffCoefPricestoLr90d =
      historiesPairNew[dateKey].coefPrice - value;
    if (historiesPairNew[dateKey].diffCoefPricestoLr90d > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr90d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr90d
      );
    } else if (historiesPairNew[dateKey].diffCoefPricestoLr90d < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr90d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr90d * -1
      );
    }
  });

  let stdevPositiveArraydiffCoefPricestoLr,
    // stdevPositiveArraydiffCoefPricestoLr3d,
    // stdevPositiveArraydiffCoefPricestoLr7d,
    stdevPositiveArraydiffCoefPricestoLr30d,
    stdevPositiveArraydiffCoefPricestoLr60d,
    stdevPositiveArraydiffCoefPricestoLr90d;

  //* стандратное отклонение
  stdevPositiveArraydiffCoefPricestoLr = getStandardDeviation(
    positiveArraydiffCoefPricestoLr
  );
  // stdevPositiveArraydiffCoefPricestoLr3d = getStandardDeviation(
  //   positiveArraydiffCoefPricestoLr3d
  // )
  // stdevPositiveArraydiffCoefPricestoLr7d = getStandardDeviation(
  //   positiveArraydiffCoefPricestoLr7d
  // )
  stdevPositiveArraydiffCoefPricestoLr30d = getStandardDeviation(
    positiveArraydiffCoefPricestoLr30d
  );
  stdevPositiveArraydiffCoefPricestoLr60d = getStandardDeviation(
    positiveArraydiffCoefPricestoLr60d
  );
  stdevPositiveArraydiffCoefPricestoLr90d = getStandardDeviation(
    positiveArraydiffCoefPricestoLr90d
  );

  let stdevNegativeArraydiffCoefPricestoLr,
    // stdevNegativeArraydiffCoefPricestoLr3d,
    // stdevNegativeArraydiffCoefPricestoLr7d,
    stdevNegativeArraydiffCoefPricestoLr30d,
    stdevNegativeArraydiffCoefPricestoLr60d,
    stdevNegativeArraydiffCoefPricestoLr90d;

  stdevNegativeArraydiffCoefPricestoLr = getStandardDeviation(
    negativeArraydiffCoefPricestoLr
  );
  // stdevNegativeArraydiffCoefPricestoLr3d = getStandardDeviation(
  //   negativeArraydiffCoefPricestoLr3d
  // )
  // stdevNegativeArraydiffCoefPricestoLr7d = getStandardDeviation(
  //   negativeArraydiffCoefPricestoLr7d
  // )
  stdevNegativeArraydiffCoefPricestoLr30d = getStandardDeviation(
    negativeArraydiffCoefPricestoLr30d
  );
  stdevNegativeArraydiffCoefPricestoLr60d = getStandardDeviation(
    negativeArraydiffCoefPricestoLr60d
  );
  stdevNegativeArraydiffCoefPricestoLr90d = getStandardDeviation(
    negativeArraydiffCoefPricestoLr90d
  );

  //* вариативность
  let varPositiveArraydiffCoefPricestoLr,
    // varPositiveArraydiffCoefPricestoLr3d,
    // varPositiveArraydiffCoefPricestoLr7d,
    varPositiveArraydiffCoefPricestoLr30d,
    varPositiveArraydiffCoefPricestoLr60d,
    varPositiveArraydiffCoefPricestoLr90d;

  varPositiveArraydiffCoefPricestoLr = calculateVariance(
    positiveArraydiffCoefPricestoLr
  );

  let varNegativeArraydiffCoefPricestoLr,
    // varNegativeArraydiffCoefPricestoLr3d,
    // varNegativeArraydiffCoefPricestoLr7d,
    varNegativeArraydiffCoefPricestoLr30d,
    varNegativeArraydiffCoefPricestoLr60d,
    varNegativeArraydiffCoefPricestoLr90d;

  varNegativeArraydiffCoefPricestoLr = calculateVariance(
    negativeArraydiffCoefPricestoLr
  );

  // varNegativeArraydiffCoefPricestoLr3d = calculateVariance(
  //   negativeArraydiffCoefPricestoLr3d
  // )
  // varNegativeArraydiffCoefPricestoLr7d = calculateVariance(
  //   negativeArraydiffCoefPricestoLr7d
  // )
  varNegativeArraydiffCoefPricestoLr30d = calculateVariance(
    negativeArraydiffCoefPricestoLr30d
  );
  varNegativeArraydiffCoefPricestoLr60d = calculateVariance(
    negativeArraydiffCoefPricestoLr60d
  );
  varNegativeArraydiffCoefPricestoLr90d = calculateVariance(
    negativeArraydiffCoefPricestoLr90d
  );

  //* среднее
  let avgPositiveArraydiffCoefPricestoLr,
    // avgPositiveArraydiffCoefPricestoLr3d,
    // avgPositiveArraydiffCoefPricestoLr7d,
    avgPositiveArraydiffCoefPricestoLr30d,
    avgPositiveArraydiffCoefPricestoLr60d,
    avgPositiveArraydiffCoefPricestoLr90d;

  avgPositiveArraydiffCoefPricestoLr = calculateAvg(
    positiveArraydiffCoefPricestoLr
  );
  // avgPositiveArraydiffCoefPricestoLr3d = calculateAvg(
  //   positiveArraydiffCoefPricestoLr3d
  // )
  // avgPositiveArraydiffCoefPricestoLr7d = calculateAvg(
  //   positiveArraydiffCoefPricestoLr7d
  // )
  avgPositiveArraydiffCoefPricestoLr30d = calculateAvg(
    positiveArraydiffCoefPricestoLr30d
  );
  avgPositiveArraydiffCoefPricestoLr60d = calculateAvg(
    positiveArraydiffCoefPricestoLr60d
  );
  avgPositiveArraydiffCoefPricestoLr90d = calculateAvg(
    positiveArraydiffCoefPricestoLr90d
  );

  let avgNegativeArraydiffCoefPricestoLr,
    // avgNegativeArraydiffCoefPricestoLr3d,
    // avgNegativeArraydiffCoefPricestoLr7d,
    avgNegativeArraydiffCoefPricestoLr30d,
    avgNegativeArraydiffCoefPricestoLr60d,
    avgNegativeArraydiffCoefPricestoLr90d;

  avgNegativeArraydiffCoefPricestoLr = calculateAvg(
    negativeArraydiffCoefPricestoLr
  );
  // avgNegativeArraydiffCoefPricestoLr3d = calculateAvg(
  //   positiveArraydiffCoefPricestoLr3d
  // )
  // avgNegativeArraydiffCoefPricestoLr7d = calculateAvg(
  //   positiveArraydiffCoefPricestoLr7d
  // )
  avgNegativeArraydiffCoefPricestoLr30d = calculateAvg(
    negativeArraydiffCoefPricestoLr30d
  );
  avgNegativeArraydiffCoefPricestoLr60d = calculateAvg(
    negativeArraydiffCoefPricestoLr60d
  );
  avgNegativeArraydiffCoefPricestoLr90d = calculateAvg(
    negativeArraydiffCoefPricestoLr90d
  );

  //* коэффициент вариативности
  let coefVarPositiveArraydiffCoefPricestoLr,
    // coefVarPositiveArraydiffCoefPricestoLr3d,
    // coefVarPositiveArraydiffCoefPricestoLr7d,
    coefVarPositiveArraydiffCoefPricestoLr30d,
    coefVarPositiveArraydiffCoefPricestoLr60d,
    coefVarPositiveArraydiffCoefPricestoLr90d;

  coefVarPositiveArraydiffCoefPricestoLr =
    stdevPositiveArraydiffCoefPricestoLr / avgPositiveArraydiffCoefPricestoLr;

  // coefVarPositiveArraydiffCoefPricestoLr3d =
  //   stdevPositiveArraydiffCoefPricestoLr3d /
  //   avgPositiveArraydiffCoefPricestoLr3d

  // coefVarPositiveArraydiffCoefPricestoLr7d =
  //   stdevPositiveArraydiffCoefPricestoLr7d /
  //   avgPositiveArraydiffCoefPricestoLr7d

  coefVarPositiveArraydiffCoefPricestoLr30d =
    stdevPositiveArraydiffCoefPricestoLr30d /
    avgPositiveArraydiffCoefPricestoLr30d;

  coefVarPositiveArraydiffCoefPricestoLr60d =
    stdevPositiveArraydiffCoefPricestoLr60d /
    avgPositiveArraydiffCoefPricestoLr60d;

  coefVarPositiveArraydiffCoefPricestoLr90d =
    stdevPositiveArraydiffCoefPricestoLr90d /
    avgPositiveArraydiffCoefPricestoLr90d;

  let coefVarNegativeArraydiffCoefPricestoLr,
    // coefVarNegativeArraydiffCoefPricestoLr3d,
    // coefVarNegativeArraydiffCoefPricestoLr7d,
    coefVarNegativeArraydiffCoefPricestoLr30d,
    coefVarNegativeArraydiffCoefPricestoLr60d,
    coefVarNegativeArraydiffCoefPricestoLr90d;

  coefVarNegativeArraydiffCoefPricestoLr =
    stdevNegativeArraydiffCoefPricestoLr / avgNegativeArraydiffCoefPricestoLr;

  // coefVarNegativeArraydiffCoefPricestoLr3d =
  //   stdevNegativeArraydiffCoefPricestoLr3d /
  //   avgNegativeArraydiffCoefPricestoLr3d

  // coefVarNegativeArraydiffCoefPricestoLr7d =
  //   stdevNegativeArraydiffCoefPricestoLr7d /
  //   avgNegativeArraydiffCoefPricestoLr7d

  coefVarNegativeArraydiffCoefPricestoLr30d =
    stdevNegativeArraydiffCoefPricestoLr30d /
    avgNegativeArraydiffCoefPricestoLr30d;

  coefVarNegativeArraydiffCoefPricestoLr60d =
    stdevNegativeArraydiffCoefPricestoLr60d /
    avgNegativeArraydiffCoefPricestoLr60d;

  coefVarNegativeArraydiffCoefPricestoLr90d =
    stdevNegativeArraydiffCoefPricestoLr90d /
    avgNegativeArraydiffCoefPricestoLr90d;

  // //* расчет коэффициента объема
  // const lrCoefVolumes = findLineByLeastSquares(times, coefVolumes)
  // lrCoefVolumes.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   historiesPairNew[dateKey].lrCoefVolume = value
  // })
  // //* расчет коэффициента капитализации
  // const lrcoefPriceMarketCaps = findLineByLeastSquares(times, coefMarketCaps)
  // lrcoefPriceMarketCaps.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   historiesPairNew[dateKey].lrCoefPriceMarketCap = value
  // })
  // //* расчет коэффициента волантильности
  // const lrCoefVolatilitys = findLineByLeastSquares(times, coefVolatilitys)
  // lrCoefVolatilitys.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   historiesPairNew[dateKey].lrCoefVolatility = value
  // })

  // arrayOfObject = Object.values(historiesPairNew)
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

  const arrayOfObjecthistoriesPairNew = Object.values(historiesPairNew);
  arrayOfObjecthistoriesPairNew.forEach((rowObject) => {
    if (
      rowObject.lrCoefPrice &&
      rowObject.dateUnix >= dateFromMetric.unix &&
      rowObject.dateUnix <= dateToMetric.unix
    ) {
      rowObject.lrCoefPriceHigh =
        rowObject.lrCoefPrice +
        stdevPositiveArraydiffCoefPricestoLr *
          (coefVarPositiveArraydiffCoefPricestoLr + 1);
      // rowObject.stdevPositiveArraydiffCoefPricestoLr = stdevPositiveArraydiffCoefPricestoLr
      // rowObject.varPositiveArraydiffCoefPricestoLr = varPositiveArraydiffCoefPricestoLr
      // rowObject.avgPositiveArraydiffCoefPricestoLr = avgPositiveArraydiffCoefPricestoLr
      // rowObject.coefVarPositiveArraydiffCoefPricestoLr = coefVarPositiveArraydiffCoefPricestoLr
      rowObject.lrCoefPriceLow =
        rowObject.lrCoefPrice -
        stdevNegativeArraydiffCoefPricestoLr *
          (coefVarNegativeArraydiffCoefPricestoLr + 1);
      rowObject.coefPriceAth = coefPriceAth.coefPrice;
      rowObject.coefPriceAtl = coefPriceAtl.coefPrice;
      // rowObject.stdevNegativeArraydiffCoefPricestoLr = stdevNegativeArraydiffCoefPricestoLr
      // rowObject.varNegativeArraydiffCoefPricestoLr = varNegativeArraydiffCoefPricestoLr
      // rowObject.avgNegativeArraydiffCoefPricestoLr = avgNegativeArraydiffCoefPricestoLr
      // rowObject.coefVarNegativeArraydiffCoefPricestoLr = coefVarNegativeArraydiffCoefPricestoLr
    } else {
      rowObject.lrCoefPrice = void 0;
      rowObject.lrCoefPriceHigh = void 0;
      rowObject.lrCoefPriceLow = void 0;
      rowObject.coefPriceAth = void 0;
      rowObject.coefPriceAtl = void 0;
    }

    // if (rowObject.lrCoefPrice3d) {
    //   rowObject.lrCoefPriceHigh3d =
    //     rowObject.lrCoefPrice3d +
    //     stdevPositiveArraydiffCoefPricestoLr3d *
    //       (coefVarPositiveArraydiffCoefPricestoLr3d + 1)

    //   rowObject.lrCoefPriceLow3d =
    //     rowObject.lrCoefPrice3d -
    //     stdevNegativeArraydiffCoefPricestoLr3d *
    //       (coefVarNegativeArraydiffCoefPricestoLr3d + 1)
    // }

    // if (rowObject.lrCoefPrice7d) {
    //   rowObject.lrCoefPriceHigh7d =
    //     rowObject.lrCoefPrice7d +
    //     stdevPositiveArraydiffCoefPricestoLr7d *
    //       (coefVarPositiveArraydiffCoefPricestoLr7d + 1)

    //   rowObject.lrCoefPriceLow7d =
    //     rowObject.lrCoefPrice7d -
    //     stdevNegativeArraydiffCoefPricestoLr7d *
    //       (coefVarNegativeArraydiffCoefPricestoLr7d + 1)
    // }

    if (rowObject.lrCoefPrice30d) {
      rowObject.lrCoefPriceHigh30d =
        rowObject.lrCoefPrice30d +
        stdevPositiveArraydiffCoefPricestoLr30d *
          (coefVarPositiveArraydiffCoefPricestoLr30d + 1);

      rowObject.lrCoefPriceLow30d =
        rowObject.lrCoefPrice30d -
        stdevNegativeArraydiffCoefPricestoLr30d *
          (coefVarNegativeArraydiffCoefPricestoLr30d + 1);
    }

    if (rowObject.lrCoefPrice60d) {
      rowObject.lrCoefPriceHigh60d =
        rowObject.lrCoefPrice60d +
        stdevPositiveArraydiffCoefPricestoLr60d *
          (coefVarPositiveArraydiffCoefPricestoLr60d + 1);

      rowObject.lrCoefPriceLow60d =
        rowObject.lrCoefPrice60d -
        stdevNegativeArraydiffCoefPricestoLr60d *
          (coefVarNegativeArraydiffCoefPricestoLr60d + 1);
    }

    if (rowObject.lrCoefPrice90d) {
      rowObject.lrCoefPriceHigh90d =
        rowObject.lrCoefPrice90d +
        stdevPositiveArraydiffCoefPricestoLr90d *
          (coefVarPositiveArraydiffCoefPricestoLr90d + 1);

      rowObject.lrCoefPriceLow90d =
        rowObject.lrCoefPrice90d -
        stdevNegativeArraydiffCoefPricestoLr90d *
          (coefVarNegativeArraydiffCoefPricestoLr90d + 1);
    }
  });
  const historiesArrayOfObject = Object.values(arrayOfObjecthistoriesPairNew);
  histories.truncateInsertRows([...historiesOldData, ...historiesArrayOfObject]);
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
const calculateAvg = (values) => {
  const mean = values.reduce((sum, current) => sum + current) / values.length;
  return mean
};

// Calculate variance (dispersion)
const calculateVariance = (values) => {
  const average = calculateAvg(values);
  const squareDiffs = values.map((value) => {
    const diff = value - average;
    return diff * diff
  });
  const variance = calculateAvg(squareDiffs);
  return variance
};
