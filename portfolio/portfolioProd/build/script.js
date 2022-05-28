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
    return new Date(this.date).valueOf() / 1000
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
    startDate.setDate(this.date.getDate() - day);
    return startDate
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
        (strtdt.getTime() - enddt.getTime()) / (24 * 3600 * 1000)
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
class FormatNumber {
  constructor(number = 0) {
    this.number = typeof string === 'number' ? number : number * 1;
  }

  /**
   * Преобразование даты в числовом формате YYYYMMDD в тип дата
   *
   * @returns {date} Дата
   */
  getDate() {
    const numberString = this.number.toString();
    const year = numberString.substr(0, 4) * 1;
    const month = numberString.substr(4, 2) * 1 - 1;
    const day = numberString.substr(6, 2) * 1;
    return new Date(year, month, day)
  }

  getHourAndMinuteFromNumber() {
    let t = this.number.toString();
    let h;
    let m;
    if (t.toString().length === 4) {
      h = t.toString().slice(0, 2) * 1;
      m = t.toString().slice(2, 4) * 1;
    } else if (t.toString().length === 3) {
      h = t.toString().slice(0, 1) * 1;
      m = t.toString().slice(1, 3) * 1;
    }
    if (t.toString().length === 2) {
      h = 0;
      m = t * 1;
    }
    return {
      h,
      m,
    }
  }
}

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
    // if (!Object.keys(this.object).length) {
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

class WorkSheetRange extends WorkSheet {
  constructor(spreadSheetName, sheetName, head, range) {
    super(spreadSheetName, sheetName, head);
    this.workSheet = range.getSheet();
    this.arrayOfObject = [];
    this.object = {};
    this.isChangeData = false;
    this.isRange = true;
    this.range = range;
    this.startRow = this.range.rowStart;
    this.rowEnd = this.range.rowEnd;
    this.countRow = this.range.rowEnd - this.range.rowStart + 1;
    this.countColumn = this.range.columnEnd - this.range.columnStart + 1;
    this.firstRowNum = this.range.rowStart;
    this.isChangePrimaryKey = false;
    this.isRange = true;
    this.dataRange = range.offset(
      0,
      1 - this.range.columnStart,
      this.countRow,
      this.maxColumn
    );
    this.rowNumArray = [...Array(this.countRow).keys()].map(
      (m) => (m = m + this.range.rowStart)
    );
    this.columnNumArray = [...Array(this.countColumn).keys()].map(
      (m) => (m = m + this.range.columnStart)
    );
    this.workSheetMetadata = new WorkSheetMetadata(this.workSheet);
  }

  get isDeleteRow() {
    return this.countColumn === this.maxColumn
  }

  getFact() {
    try {
      this.dataRange.getValues().forEach((arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow;
        const rowKey = arrayRow[this.head.rowKey.idx];
        const instanceRow = arrayRow.reduce((object, value, index) => {
          object['rowNum'] = rowNum;
          if (!object[this.headKey[index]]) {
            object[this.headKey[index]] = value;
          }
          return object
        }, {});
        if (!this.object[rowKey]) {
          this.object[rowKey] = instanceRow;
        }
        this.arrayOfObject.push(instanceRow);
      });
      return this
    } catch (error) {
      console.error('WorkSheetRange.getFact', error.stack);
    }
  }

  getDimension() {
    try {
      this.object = this.dataRange
        .getValues()
        .reduce((objectRow, arrayRow, indexRow) => {
          const rowNum = this.firstRowNum + indexRow;
          const object = arrayRow.reduce((object, value, index) => {
            if (!object[this.headKey[index]]) {
              object[this.headKey[index]] = value;
            }
            object['rowNum'] = rowNum;
            return object
          }, {});
          const newRowKey = this.getPrimaryKey(object);

          object.isChangePrimaryKey = false;
          if (object.rowKey !== newRowKey) {
            object.rowKey = newRowKey;
            this.isChangePrimaryKey = true;
          }
          const isNotNull = this.isNotNull(object);

          if (!objectRow[object.rowKey] && isNotNull) {
            objectRow[object.rowKey] = object;
          }
          return objectRow
        }, {});

      this.arrayOfObject = Object.values(this.object);
      this.isChangeData = this.arrayOfObject.length ? true : false;
      return this
    } catch (error) {
      console.error('WorkSheetRange.getDimension', error.stack);
    }
  }

  getTransactions() {
    try {
      this.dataRange.getValues().forEach((arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow;
        const rowNumKey = new Hash(rowNum + this.sheetName).md5;
        const isChangeRow = this.isChangeRow(rowNum, arrayRow);
        let rowIdCache;
        if (isChangeRow.sign) {
          let isNewRowId = false;
          const rowIdOld = arrayRow[this.head.rowId.idx] * 1;
          let rowId;
          if (rowIdOld) {
            rowId = arrayRow[this.head.rowId.idx];
          } else {
            const maxRowId = this.workSheetMetadata.getMaxRowId();
            rowIdCache = this.scriptCache.getCache(rowNumKey);
            rowId = rowIdCache ? rowIdCache : maxRowId + 1;
            isNewRowId = true;
          }
          const rowKey = new Hash(rowId + this.sheetName).md5;
          const rowKeyTimestamp = new Hash(
            rowNum + this.sheetName + 'timestamp'
          ).md5;
          const instanceRow = arrayRow.reduce((object, value, column) => {
            if (!object[this.headKey[column]]) {
              object[this.headKey[column]] = value;
              object['rowKey'] = rowKey;
              object['rowNum'] = rowNum;
              object['rowHash'] = isChangeRow.hash;
              object['timestamp'] = new Date().valueOf();
              object['rowId'] = rowId;
            }
            return object
          }, {});
          const rowHashCache = this.scriptCache.getCache(rowKey);
          if (rowHashCache !== instanceRow.rowHash) {
            this.scriptCache.addCache(rowKey, instanceRow.rowHash);
            this.scriptCache.addCache(rowKeyTimestamp, instanceRow.timestamp);
            const isNotNull = this.isNotNull(instanceRow);
            if (isNotNull) {
              if (isNewRowId) {
                if (!rowIdCache) {
                  this.workSheetMetadata.addMaxRowId(rowId);
                }
                this.scriptCache.addCache(rowNumKey, rowId);
              }
              if (!this.object[rowKey]) {
                this.object[rowKey] = instanceRow;
              }
              this.arrayOfObject.push(instanceRow);
            }
          }
        }
      });
      this.isChangeData = this.arrayOfObject.length ? true : false;
      return this
    } catch (error) {
      console.error('WorkSheetRange.getTransactions', error.stack);
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
          );
        });
      }
    } catch (error) {
      console.error('WorkSheetRange.savePrimaryKeyChanges', error.stack);
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
      const rowHash = new Hash(arrayRow.join('#')).md5;
      const rowHashOld = this.scriptCache.getCache(
        this.sheetName + 'rowkey' + rowNum
      );
      if (rowHash !== rowHashOld) {
        this.scriptCache.addCache(this.sheetName + 'rowkey' + rowNum, rowHash);
        return { sign: true, hash: rowHash }
      } else {
        return { sign: false, hash: rowHash }
      }
    } catch (error) {
      console.error('WorkSheetRange.isChangeRow', error.stack);
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
    );
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
          const value = rowObject[column];
          if (value instanceof Date) {
            return new Date(value).valueOf()
          } else {
            return value
          }
        })
        .join('')
    ).md5
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
class Metadata {
  /**
   * Методы работы с метаданными листа книги
   * @param {object} target объект метаданных: принимает книгу, лист, диапазон
   */
  constructor(target) {
    this.target = target;
    this.metadata = target.getDeveloperMetadata().reduce((keys, metadata) => {
      keys[metadata.getKey()] = {
        remove: () => metadata.remove(),
        getKey: () => metadata.getKey(),
        getValue: () => metadata.getValue(),
        setValue: (value) => metadata.setValue(value),
        value: metadata.getValue(),
      };
      return keys
    }, {});
    this.metaMap = new Map(Object.entries(this.metadata));
  }
  /**
   * Добавление значения в метаданные листа
   * @param {string} key ключ метаданых
   * @param {string} value значение ключа
   */
  addMetadata(key, value) {
    const newValue = value;
    if (this.metaMap.has(key)) {
      const oldValue = this.metadata[key].getValue();
      if (new Hash(newValue).md5 !== new Hash(oldValue).md5) {
        this.metadata[key].setValue(newValue);
        this.metadata[key].value = newValue;
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
          };
          return keys
        }, {});
      this.metaMap = new Map(Object.entries(this.metadata));
    }
  }

  getMetadata(key) {
    if (this.metaMap.has(key)) {
      return this.metadata[key].getValue()
    }
  }

  deleteMetadata(key) {
    key = key.toString();
    if (this.metaMap.has(key)) {
      this.metadata[key].remove();
    }
  }
  deleteAllMetadata() {
    const arrayMetadataKey = Object.keys(this.metadata);
    arrayMetadataKey.forEach((key) => {
      this.metadata[key].remove();
    });
    console.log('Delete keys: ', arrayMetadataKey.length);
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
    WorkSheetMetadata.instance = this;
    this.metadata = new Metadata(workSheet);
    this.workSheetNameHash = new Hash(workSheet.getName());
    this.workSheetNameHashMd5 = new Hash(workSheet.getName()).md5;
  }

  /**
   * Добавление ключа строки в метаданные
   * @param {number} rowNum номер строки листа
   */
  addRowKey(rowNum, value) {
    const key = 'ROWKEY_' + rowNum;
    this.metadata.addMetadata(key, value);
    return value
  }

  getRowKey(rowNum) {
    const key = 'ROWKEY_' + rowNum;
    return this.metadata.getMetadata(key)
  }

  /**
   * Добавление максимального идентификатора строки
   * @param {number} rowNum номер строки листа
   */
  addMaxRowId(rowId) {
    this.metadata.addMetadata('MAXROWID', rowId + '');
    return rowId
  }

  /**
   * Получение максимального идентификатора строки
   * @returns Максимальный идентификатор на листе
   */
  getMaxRowId() {
    const data = this.metadata.getMetadata('MAXROWID') * 1;
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
    const value = this.workSheetNameHash.stringUpperCase;
    this.metadata.addMetadata('SHEETKEY', value);
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
    const oldValue = this.metadata.getMetadata('SHEETNAME');
    if (oldValue) {
      return oldValue
    } else {
      this.metadata.addMetadata(
        'SHEETNAME',
        this.workSheetNameHash.stringUpperCase
      );
      return this.workSheetNameHash.stringUpperCase
    }
  }
}

class Log {
  constructor(spreadSheetName) {
    if (Log.exists) {
      return Log.instance
    }
    Log.instance = this;
    Log.exists = true;
    this.headLog = {
      type: 'tx',
      rowNum: 1,
      columns: {
        dateTime: { alias: 'Date and time', idx: 0, type: 'date' },
        method: { alias: 'Method', idx: 1 },
        type: { alias: 'Type', idx: 2 },
        name: { alias: 'Name', idx: 3 },
        message: { alias: 'Message', idx: 4 },
        stack: { alias: 'Stack', idx: 5 },
        rowId: { alias: 'Row Id', idx: 6 },
      },
    };
    this.workSheet = new WorkSheet(
      spreadSheetName,
      'Log',
      this.headLog
    ).getDataset();
  }

  /**
   * Добавление ошибки в реестр ошибок
   * @param {string} method Название метода
   * @param {string} error Объект ошибки {name, massage, stack}
   */
  addError(method, error) {
    new Promise((resolve) => {
      this.workSheet.insertRow({
        dateTime: new FormatDate().getFormatDate('yyyy-MM-dd HH:mm:ss'),
        method,
        type: 'error',
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
      resolve();
    }).then(() => {
      this.truncateLog();
    });
  }

  /**
   * Добаление информации в лог
   * @param {string} method Название метода
   * @param {string} name Название параметры
   * @param {*} message  Сообщение
   */
  addMessage(method, parametr, message) {
    new Promise((resolve) => {
      const messageString =
        typeof message !== 'string' ? JSON.stringify(message) : message;
      this.workSheet.insertRow({
        dateTime: new FormatDate().getFormatDate('yyyy-MM-dd HH:mm:ss'),
        method: method,
        type: 'message',
        name: parametr,
        message: messageString,
        stack: void 0,
      });
      resolve();
    }).then(() => {
      this.truncateLog();
    });
  }

  /**
   * Удление старых записей из лога
   */
  truncateLog() {
    if (this.workSheet.countRow > 100) {
      this.workSheet.deleteRow(2, 25);
    }
  }
}

new Environment([
  {
    spreadSheetName: 'portfolio',
    sheetId: '1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1iGoWj5YHB_iQi7o09-vJF6XJeveFI54lLOlx193Y0f8',
    scriptId: '19LYhtfrshQkWLvGQedmXFG4XJkcOR3cO9-E6Ne32GmKT766phfg71J_d',
    area: 'dev',
  },
]);

class Portfolio {
  constructor() {
    if (Portfolio.exists) {
      return Portfolio.instance
    }
    Portfolio.instance = this;
    Portfolio.exists = true;
    this.workSheetHeads = {
      registry: {
        type: 'tx',
        rowNum: 1,
        columns: {
          operation: { alias: 'Operation', idx: 0, notNull: true },
          accountSender: { alias: 'Account sender', idx: 1, notNull: true },
          accountRecipient: { alias: 'Account recipient', idx: 2 },
          platform: { alias: 'Platform', idx: 3, notNull: true },
          service: { alias: 'Service', idx: 4, notNull: true },
          sender: { alias: 'Sender', idx: 5, notNull: true },
          recipient: { alias: 'Recipient', idx: 6 },
          lockStatus: { alias: 'Lock status', idx: 7 },
          coin: { alias: 'Coin', idx: 8, notNull: true },
          coinQty: { alias: 'Coin, qty', idx: 9 },
          currency: { alias: 'Currency', idx: 10 },
          currencyQty: { alias: 'Currency, qty', idx: 11 },
          currencyPerCoin: { alias: 'Currency per coin', idx: 12 },
          feeSender: { alias: 'Fee sender', idx: 13 },
          feeCurrency: { alias: 'Fee currency', idx: 14 },
          feeQty: { alias: 'Fee, qty', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          date: {
            alias: 'Date',
            idx: 17,
            notNull: true,
            type: 'date',
            default: void 0,
          },
          time: { alias: 'Time', idx: 18, notNull: true },
          isDelete: { alias: 'Is delete', idx: 19 },
          dateSaved: {
            alias: 'Date saved',
            idx: 20,
            type: 'date',
            default: new Date(),
          },
          timeSpent: {
            alias: 'Time spent (hh:mm:ss.ms)',
            idx: 21,
            type: 'string',
          },
          rowId: { alias: 'Row ID', idx: 22 },
        },
      },
      symbols: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: {
            alias: 'Source',
            idx: 1,
            notNull: true,
          },
          name: {
            alias: 'Full name',
            idx: 2,
            notNull: true,
          },
          symbol: {
            alias: 'Symbol',
            pk: true,
            idx: 3,
            notNull: true,
          },
          symbolCategory: {
            alias: 'Symbol category ',
            idx: 4,
            notNull: true,
          },
          ecosystem: {
            alias: 'Ecosystem',
            idx: 5,
          },
          marketCapGroup: {
            alias: 'MarketCap group',
            idx: 6,
          },
          sourceId: { alias: 'Source id', idx: 7 },
          price: { alias: 'Price', idx: 8 },
          update: {
            alias: 'Update',
            idx: 9,
            type: 'date',
            default: new Date(),
          },
        },
      },
      transactions: {
        type: 'fct',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          sourceKey: { alias: 'Source key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          sourceName: { alias: 'Source name', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          account: { alias: 'Account', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          mainSymbol: { alias: 'Main coin', idx: 11 },
          symbol: { alias: 'Coin', idx: 12 },
          quantity: { alias: 'Quantity', idx: 13 },
          price: { alias: 'Price', idx: 14 },
          cost: { alias: 'Cost', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          isDelete: { alias: 'Delete', idx: 17 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 18 },
          isFee: { alias: 'Is fee', idx: 19 },
          isLock: { alias: 'Is lock', idx: 20 },
          isAvgPrice: { alias: 'Is average price', idx: 21 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 22,
          },
          registryRowId: { alias: 'Registry row id', idx: 23 },
          registryRowKey: { alias: 'Registry row key', idx: 24 },
          updateDate: {
            alias: 'Update date',
            idx: 25,
            type: 'date',
            default: new Date(),
          },
        },
      },
      deletedTransactions: {
        type: 'fct',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          sourceKey: { alias: 'Source key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          sourceName: { alias: 'Source name', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          account: { alias: 'Account', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          mainSymbol: { alias: 'Main coin', idx: 11 },
          symbol: { alias: 'Coin', idx: 12 },
          quantity: { alias: 'Quantity', idx: 13 },
          price: { alias: 'Price', idx: 14 },
          cost: { alias: 'Cost', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          isDelete: { alias: 'Delete', idx: 17 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 18 },
          isFee: { alias: 'Is fee', idx: 19 },
          isLock: { alias: 'Is lock', idx: 20 },
          isAvgPrice: { alias: 'Is average price', idx: 21 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 22,
          },
          registryRowId: { alias: 'Registry row id', idx: 23 },
          registryRowKey: { alias: 'Registry row key', idx: 24 },
          updateDate: {
            alias: 'Update date',
            idx: 25,
            type: 'date',
            default: new Date(),
          },
          deleteDate: {
            alias: 'Delete date',
            idx: 26,
            type: 'date',
            default: new Date(),
          },
        },
      },
      flow: {
        type: 'tx',
        rowNum: 1,
        columns: {
          mainAccount: { alias: 'Main account', idx: 0 },
          account: { alias: 'Account', idx: 1 },
          contractor: { alias: 'Contractor', idx: 2 },
          contractorType: { alias: 'Contractor type', idx: 3 },
          contractorCategory: { alias: 'Contractor category', idx: 4 },
          symbol: { alias: 'Symbol name', idx: 5 },
          symbolFullName: { alias: 'Symbol full name', idx: 6 },
          symbolCategory: { alias: 'Symbol category', idx: 7 },
          symbolEcosystem: { alias: 'Symbol ecosystem', idx: 8 },
          symbolMarketCapGroup: { alias: 'Symbol marketcap group', idx: 9 },
          quantityOwnInFlow: { alias: 'Quantity (own in flow)', idx: 10 },
          quantityInFlow: { alias: 'Quantity (in flow)', idx: 11 },
          quantityOutFlow: { alias: 'Quantity (out flow)', idx: 12 },
          quantityRest: { alias: 'Quantity (rest)', idx: 13 },
          quantityRestLock: { alias: 'Quantity (rest lock)', idx: 14 },
          quantityRestUnlock: { alias: 'Quantity (rest unlock)', idx: 15 },
          priceOwnInFlow: { alias: 'Price (own in flow), $', idx: 16 },
          priceInFlow: { alias: 'Price (in flow), $', idx: 17 },
          priceOutFlow: { alias: 'Price (out flow), $', idx: 18 },
          priceRestInFlow: { alias: 'Price (rest in flow), $', idx: 19 },
          priceRest: { alias: 'Price (rest), $', idx: 20 },
          costOwnInFlow: { alias: 'Cost (own in flow), $', idx: 21 },
          costInFlow: { alias: 'Cost (in flow), $', idx: 22 },
          costOutFlow: { alias: 'Cost (out flow), $', idx: 23 },
          costRest: { alias: 'Cost (rest), $', idx: 24 },
          costRestInFlow: { alias: 'Cost (rest in flow), $', idx: 25 },
          costRestLock: { alias: 'Cost (rest lock), $', idx: 26 },
          costRestUnlock: { alias: 'Cost (rest unlock), $', idx: 27 },
          pnlTotal: { alias: 'PnL (total), $', idx: 28 },
          pnlRest: { alias: 'PnL (rest), $', idx: 29 },
          payback: { alias: 'Payback, $', idx: 30 },
          quantityRebalance: { alias: 'Rebalance, qty', idx: 31 },
          dayInPortfolioAvg: {
            alias: 'Average day in portfolio',
            idx: 32,
          },
          update: {
            alias: 'Update data mart',
            idx: 33,
            type: 'date',
            default: new Date(),
          },
          rowId: { alias: 'Row ID', idx: 34, hide: true },
        },
      },
      coins: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: { alias: 'Source', pk: true, idx: 1, notNull: true },
          name: { alias: 'Name', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 3, notNull: true },
          id: { alias: 'Id', idx: 4 },
        },
      },
      sources: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      symbolCategory: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          nameRu: { alias: 'Name (ru)', idx: 2, notNull: true },
          share: { alias: 'Share, %', idx: 3 },
        },
      },
      proofType: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          description: { alias: 'Description', idx: 1 },
        },
      },

      services: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          nameRu: { alias: 'Name (ru)', idx: 2 },
        },
      },
      operations: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      ecosystem: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          proofType: { alias: 'Proof type', idx: 2, notNull: true },
          share: { alias: 'Share, %', idx: 3 },
        },
      },
      accounts: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          mainAccount: { alias: 'Main account', idx: 2, notNull: true },
          telegramId: { alias: 'Telegram Id', idx: 3 },
        },
      },
      lockStatus: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      contractors: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          type: { alias: 'Type', idx: 2, notNull: true },
          category: { alias: 'Category', idx: 3, notNull: true },
        },
      },
      lptoken: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          account: { alias: 'Account', pk: true, idx: 1, notNull: true },
          mainSymbol: { alias: 'Main symbol', pk: true, idx: 2, notNull: true },
          mainSymbolQty: {
            alias: 'Main symbol qty',
            idx: 3,
          },
          mainSymbolHistoricalCost: {
            alias: 'Main symbol historical cost',
            idx: 4,
          },
          mainSymbolHistoricalPrice: {
            alias: 'Main symbol historical price',
            idx: 5,
          },
          pairOneSymbol: { alias: 'Pair one symbol', idx: 6 },
          pairOneQty: { alias: 'Pair one qty', idx: 7 },
          pairOnePrice: { alias: 'Pair one price', idx: 8 },
          pairTwoSymbol: { alias: 'Pair one symbol', idx: 9 },
          pairTwoQty: { alias: 'Pair two qty', idx: 10 },
          pairTwoPrice: { alias: 'Pair two price', idx: 11 },
          pairThreeSymbol: { alias: 'Pair three symbol', idx: 12 },
          pairThreeQty: { alias: 'Pair three qty', idx: 13 },
          pairThreePrice: { alias: 'Pair three price', idx: 14 },
          update: {
            alias: 'Update',
            idx: 15,
            type: 'date',
            default: new Date(),
          },
        },
      },
    };
    this.spreadSheetName = 'portfolio';
    this.log = new Log(this.spreadSheetName);
  }

  getWorkSheet(sheetName) {
    try {
      let headSheetName, isRegistry;
      headSheetName = sheetName;
      isRegistry = false;
      if (sheetName.match('Registry')) {
        headSheetName = 'Registry';
        isRegistry = true;
      }
      const head = new Header().getHead(this.workSheetHeads, headSheetName);
      const workSheet = new WorkSheet(
        this.spreadSheetName,
        sheetName,
        head
      ).getDataset();
      workSheet.isRegistry = isRegistry;
      workSheet.log = this.log;
      return workSheet
    } catch (error) {
      console.error('Portfolio.getWorkSheet', error.stack);
    }
  }

  updateOnEdit(range) {
    try {
      let sheetName, headSheetName, isRegistry;
      sheetName = range.getSheet().getSheetName();
      headSheetName = sheetName;
      isRegistry = false;
      if (sheetName.match('Registry')) {
        headSheetName = 'Registry';
        isRegistry = true;
      }
      const head = new Header().getHead(this.workSheetHeads, headSheetName);
      const workSheet = new WorkSheetRange(
        this.spreadSheetName,
        sheetName,
        head,
        range
      ).getDataset();
      workSheet.isRegistry = isRegistry;
      workSheet.log = this.log;
      return workSheet
    } catch (error) {
      console.error('Portfolio.updateOnEdit', error.stack);
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
    this.fetchStatus = false;
    this.result = '';
    this.ms = 2000;
    this.iteration = 0;
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
      const fetchPromise = () => {
        return new Promise((resolve, reject) => {
          const response = UrlFetchApp.fetch(this.url, this.data);
          const code = response.getResponseCode();
          if (code === 200) {
            this.result = JSON.parse(response.getContentText());
            this.fetchStatus = true;
            resolve();
          } else {
            reject(code);
          }
        })
      };
      const timeOutPromise = (code) => {
        return new Promise((resolve) => {
          console.log('URL: ' + this.url);
          console.log('Response code: ' + code);
          console.log('Start timeout: ' + this.ms / 1000 + ' sec');
          Utilities.sleep(this.ms);
          this.ms += 250;
          this.iteration += 1;
          if (this.iteration > 5) {
            this.fetchStatus = true;
          }
          resolve();
        })
      };
      do {
        fetchPromise().catch((code) => timeOutPromise(code));
      } while (!this.fetchStatus)

      return this.result
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * CryptoCompare instance
 */
class Instance$2 {
  /**
   * Create new inctance API CryptoCompare
   *
   */
  constructor() {
    if (Instance$2.exists) {
      return Instance$2.instance
    }
    Instance$2.instance = this;
    Instance$2.exists = true;
    this.methods = new Methods({
      domain: 'https://min-api.cryptocompare.com/data',
      query: {
        api_key:
          '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125',
      },
      data: {
        muteHttpExceptions: true,
        contentType: 'application/json',
      },
    });
  }
}
/**
 * CryptoCompare price
 */
class Price$2 {
  constructor() {
    this.methods = new Instance$2().methods;
  }

  getSinglePrice(fsym = '', tsyms = 'USD') {
    try {
      const upperTsyms = tsyms.toUpperCase();
      const upperFsym = fsym.toUpperCase();
      const resp = this.methods.get({
        endPoint: '/price',
        query: {
          fsym: upperFsym,
          tsyms: upperTsyms,
          relaxedValidation: true,
        },
      });
      return resp[upperTsyms]
    } catch (error) {
      console.error('Price.getSinglePrice', error.stack);
    }
  }

  getMultiPrice(fsyms = '', tsyms = 'USD') {
    try {
      const priceArray = [];
      const upperTsyms = tsyms.toUpperCase();
      const fsymsArray = fsyms.split(',');
      const fsymsArrayOfArray = new Array(Math.ceil(fsymsArray.length / 25))
        .fill()
        .map((_) => fsymsArray.splice(0, 25));
      fsymsArrayOfArray.forEach((fsymsPart) => {
        const result = this.methods.get({
          endPoint: '/pricemulti',
          query: {
            fsyms: fsymsPart.join(',').toUpperCase(),
            tsyms: tsyms.toUpperCase(),
            relaxedValidation: true,
          },
        });
        if (!result.Response) {
          return Object.entries(result).forEach(([symbol, tsymsValue]) => {
            priceArray.push({ symbol: symbol, price: tsymsValue[upperTsyms] });
          })
        } else {
          console.error(result.Message);
        }
      });
      return priceArray
    } catch (error) {
      console.error('Price.getMultiPrice', error.stack);
    }
  }

  getMultiFullPrice(fsyms = '', tsyms = 'USD') {
    try {
      const upperTsyms = tsyms.toUpperCase();
      const result = this.methods.get({
        endPoint: '/pricemultifull',
        query: {
          fsyms: fsyms.toUpperCase(),
          tsyms: tsyms.toUpperCase(),
          relaxedValidation: true,
        },
      });
      if (!result.Response) {
        return Object.entries(result).map(([symbol, tsymsValue]) => {
          return [symbol, tsymsValue[upperTsyms]]
        })
      } else {
        return void 0
      }
    } catch (error) {
      console.error('Price.getMultiFullPrice', error.stack);
    }
  }

  getHistoryPrice(fsym = 'BTC', ts = new Date(), tsyms = 'USD') {
    try {
      const dateUnix = new FormatDate(ts).unix;
      const upperTsyms = tsyms.toUpperCase();
      const upperFsym = fsym.toUpperCase();
      const result = this.methods.get({
        endPoint: '/pricehistorical',
        query: {
          fsym: upperFsym,
          tsyms: upperTsyms,
          ts: dateUnix,
        },
      });
      if (!result.Response) {
        return result[upperFsym][upperTsyms]
      } else {
        return void 0
      }
    } catch (error) {
      console.error('Price.getHistoryPrice', error.stack);
    }
  }
}
/**
 * CryptoCompare coin list
 */
class CoinsList$2 {
  constructor() {
    this.methods = new Instance$2().methods;
  }
  getCoinsList() {
    return this.methods.get({ endPoint: '/all/coinlist' })?.Data
  }
}

class TopList {
  constructor() {
    this.methods = new Instance$2().methods;
  }
  topMarketCap(top = 100, tsym = 'usd') {
    try {
      const upperTsym = tsym.toUpperCase();
      const limit = 100;
      let pages;
      if (top < 100) {
        pages = 1;
      } else {
        pages = Math.round(top / limit);
      }
      const list = {};
      for (let page = 0; page < pages; page++) {
        const arrayOfObject =
          this.methods.get({
            endPoint: '/top/mktcapfull',
            query: {
              tsym: upperTsym,
              limit,
              page,
            },
          })?.Data || [];
        const startPosition = limit * (page + 1) - (limit - 1);
        arrayOfObject.forEach((object, index) => {
          const key = new Hash(object.CoinInfo.Internal).md5;
          if (!list[key]) {
            list[key] = {};
          }
          list[key]['rank'] = startPosition + index;
          return list
        }, {});
      }
      return list
    } catch (error) {
      console.error('TopList.topListBy24h', error.stack);
    }
  }
}

class Transactions {
  constructor(workSheet = '') {
    if (Transactions.exists) {
      return Transactions.instance
    }

    Transactions.instance = this;
    Transactions.exists = true;
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Transactions');
    this.forDeleteRow = [];
  }

  /**
   *
   * @param {array} arrayOfObject Массив транзакций
   * @param {boolean} isRange Признак обновления диапазона передаваемых данных
   */
  updateTransactions(arrayOfObject = [], isRange = false) {
    try {
      if (isRange) {
        new Promise((resolve) => {
          const rowKeyArray = [];
          //* определение всех ключей регистра
          const registryRowKeyArray = arrayOfObject.reduce(
            (registryRowKeyArray, objectRow) => {
              if (!registryRowKeyArray.includes(objectRow.registryRowKey)) {
                registryRowKeyArray.push(objectRow.registryRowKey);
              }
              rowKeyArray.push(objectRow.rowKey);
              return registryRowKeyArray
            },
            []
          );
          //* определение всех ключей транзакций по ключам регистра
          const transactionsRowKeyArray = [];
          registryRowKeyArray.forEach((registryRowKey) => {
            this.workSheet.arrayOfObject
              .filter((row) => row.registryRowKey === registryRowKey)
              .map((row) => {
                transactionsRowKeyArray.push(row.rowKey);
              });
          });

          //* проверка ключей транзакций на избыточность
          transactionsRowKeyArray.forEach((transactionsRowKey) => {
            if (rowKeyArray.indexOf(transactionsRowKey) === -1) {
              this.forDeleteRow.push(this.workSheet.object[transactionsRowKey]);
            }
          });

          arrayOfObject.forEach((tx) => {
            const rowArray = this.workSheet.arrayOfObject.filter(
              (row) => row.rowKey === tx.rowKey
            );
            if (rowArray.length === 1) {
              const oldRow = this.workSheet.object[tx.rowKey];
              tx.rowNum = oldRow.rowNum;
              if (tx.isDelete) {
                this.forDeleteRow.push(tx);
              } else {
                this.workSheet.updateRow(tx);
              }
            } else if (rowArray.length > 1) {
              rowArray.forEach((row, indexRow) => {
                if (!indexRow) {
                  tx.rowNum = row.rowNum;
                  this.workSheet.updateRow(tx);
                } else {
                  this.forDeleteRow.push(row);
                }
              });
            } else {
              this.workSheet.insertRow(tx);
            }
          });
          resolve(registryRowKeyArray);
        }).then((registryRowKeyArray) => {
          if (this.forDeleteRow.length) {
            this.workSheet.deleteRows(this.forDeleteRow);
            //* добавление в регистр удаления
            const deletedTransactions = new Portfolio().getWorkSheet(
              'DeletedTransactions'
            );
            this.forDeleteRow.forEach((deleteRowObject) => {
              deletedTransactions.insertRow(deleteRowObject);
            });
          }
          this.workSheet.scriptCache.removeAllCache(registryRowKeyArray);
        });
      } else {
        const sourceKey = arrayOfObject[0].sourceKey;
        const otherArray = this.workSheet.arrayOfObject.filter(
          (row) => row.sourceKey !== sourceKey
        );
        const splitArray = [...otherArray, ...arrayOfObject];
        this.workSheet.truncateInsertRows(splitArray);
      }
    } catch (error) {
      console.error('Transactions.updateTransactions', error.stack);
    }
  }

  deleteforDeleteRows() {
    try {
      const newArrayOfObject = Object.values(this.workSheet.object).sort(
        (a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        }
      );
      this.workSheet.truncateInsertRows(newArrayOfObject);
    } catch (error) {
      console.error('Transactions.deleteforDeleteRows', error.stack);
    }
  }

  updateRegistryRowKey() {
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const newRegistryRowKey = new Hash(
        rowObject.registryRowId + rowObject.sourceName
      ).md5;
      rowObject.registryRowKey = newRegistryRowKey;
      return rowObject
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  updateHistoricalAveragePriceKey() {
    const accounts = new Portfolio().getWorkSheet('Accounts').object;
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      accounts[new Hash(rowObject.account).md5].mainAccount;
      const newHistoricalAveragePriceKey = new Hash(
        rowObject.account + rowObject.contractor + rowObject.symbol
      ).md5;
      rowObject.historicalAveragePriceKey = newHistoricalAveragePriceKey;
      return rowObject
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  recalculateTransactions(startRow, endRow) {
    const symbols = new Portfolio().getWorkSheet('Symbols').object;
    const accounts = new Portfolio().getWorkSheet('Accounts').object;
    const newArrayOfObject = this.workSheet.arrayOfObject.map(
      (rowObject, indexRow) => {
        if (indexRow > startRow && indexRow <= endRow) {
          if (
            [
              '84a0f3455dcca894ace136be62efa292',
              '7b33b9f52598cd60f7aa6ca0082515c4',
              'b4479040173a9f41eeb4e98339f2a21d' /*transfer,write-off, refill*/,
            ].indexOf(new Hash(rowObject.operation).md5) !== -1
          ) {
            const price = this.getHistoricalPriceBuy(
              rowObject.dateTime,
              accounts[new Hash(rowObject.account).md5]?.mainAccount,
              rowObject.symbol,
              new Hash(symbols[new Hash(rowObject.symbol).md5]?.symbolCategory)
                .md5,
              symbols,
              true
            ).historicalPrice;
            rowObject.price = price;
            rowObject.cost = rowObject.quantity * price;
            rowObject.updateDate = new Date();
          }
        }
        return rowObject
      }
    );
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  updateAccount() {
    const accounts = new Portfolio().getWorkSheet('Accounts').object;
    const symbols = new Portfolio().getWorkSheet('Symbols').object;
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      if (
        [
          'e5e3fd01394b9a81296b75d5a7f4c1a2',
          '7d5f30a0d1641c0b6980aaf2556b32ce' /*Stablecoin, Fiat*/,
        ].indexOf(
          new Hash(symbols[new Hash(rowObject.symbol).md5]?.symbolCategory).md5
        ) !== -1
      ) {
        rowObject.account =
          accounts[new Hash(rowObject.account).md5]?.mainAccount;
        rowObject.updateDate = new Date();
      }

      return rowObject
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }
}

class HistoricalPrice {
  /**
   * Получение средневзвешенной цены покупки токена
   * @param {*} dateTime дата и время
   * @param {*} account счет
   * @param {*} currencySymbol символ
   * @param {*} currencySymbolCategoryKey ключ категории токена
   * @param {object} symbolsObject справочник символов
   * @param {array} transactionsArrayOfObject факт транзакций
   * @param {*} isRange признак диапазона
   * @param {*} convert параметр конвертации
   * @returns объект цена и признак исторической цены
   */
  getHistoricalPrice(
    dateTime,
    account,
    contractor,
    currencySymbol,
    currencySymbolCategoryKey,
    symbolsObject,
    transactionsArrayOfObject,
    isRange = false,
    convert = 'usd'
  ) {
    try {
      let historicalPrice;
      let isHistoricalAveragePrice;
      historicalPrice = 0;
      isHistoricalAveragePrice = false;
      const coin = symbolsObject[new Hash(currencySymbol).md5];
      const sourceKey = new Hash(coin?.source).md5;
      const symbolId = coin?.sourceId;

      if (
        'e5e3fd01394b9a81296b75d5a7f4c1a2' ===
        currencySymbolCategoryKey /*stablecoin*/
      ) {
        //* Для стабильных токенов возвращать единицу
        historicalPrice = 1;
        isHistoricalAveragePrice = false;
      } else if (
        '7d5f30a0d1641c0b6980aaf2556b32ce' ===
        currencySymbolCategoryKey /*fiat*/
      ) {
        if (
          sourceKey === '1dab445b170a7f0acfccea645a8879e0' /*cryptocompare*/
        ) {
          historicalPrice = new Price$2().getHistoryPrice(
            symbolId,
            dateTime,
            convert
          );
          isHistoricalAveragePrice = false;
        }
      } else {
        //* Расчет средневзвешенной стоимости покупки токена на основании истории покупок для диапазона данных
        if (isRange) {
          const historicalAveragePriceKey = new Hash(
            account + contractor + currencySymbol
          ).md5;
          const historicalPriceAgg = transactionsArrayOfObject
            .filter((row) => {
              return (
                new FormatDate(row.dateTime).value <
                  new FormatDate(dateTime).value &&
                historicalAveragePriceKey === row.historicalAveragePriceKey &&
                row.isAvgPrice &&
                !row.isDelete
              )
            })
            .sort((a, b) => {
              if (
                new FormatDate(a.dateTime).value ===
                new FormatDate(b.dateTime).value
              ) {
                a.registryRowId - b.registryRowId;
              } else {
                new FormatDate(a.dateTime).value -
                  new FormatDate(b.dateTime).value;
              }
            })
            .reduce((agg, tx, indexRow) => {
              if (indexRow === 0) {
                agg = {
                  quantityRest: 0,
                  costRest: 0,
                };
              }

              agg.quantityRest += tx.quantity;
              agg.costRest += tx.cost;

              return agg
            }, {});

          const priceRestFlow =
            Math.round(historicalPriceAgg.costRest * 100) /
            100 /
            historicalPriceAgg.quantityRest;

          console.log(account, contractor, currencySymbol);
          console.log('quantityRest', historicalPriceAgg.quantityRest);
          console.log('priceRestFlow', priceRestFlow);
          console.log('costRestFlow', historicalPriceAgg.costRest);

          //* Расчет средней цены покупки токена
          if (priceRestFlow) {
            historicalPrice = priceRestFlow;
            isHistoricalAveragePrice = true;
          } else {
            if (
              new FormatDate(dateTime).yyyymmdd === new FormatDate().yyyymmdd &&
              sourceKey === 'b40555dbd3865016ed3f7b4a9bf3b806' /*coingecko*/
            ) {
              //* Получение исторической цены из coinGecko
              historicalPrice = new coinGecko.Price()
                .getMarketsPrice(symbolId)
                .reduce((price, data) => {
                  price = data.current_price;
                  return price
                }, 0);
              isHistoricalAveragePrice = false;
            } else {
              //* Получение исторической цены из CryptoCompare
              if (
                sourceKey ===
                '1dab445b170a7f0acfccea645a8879e0' /*cryptocompare*/
              ) {
                historicalPrice = new Price$2().getHistoryPrice(
                  symbolId,
                  dateTime,
                  convert
                );
                isHistoricalAveragePrice = true;
              }
            }
          }
        }
      }
      return { historicalPrice, isHistoricalAveragePrice }
    } catch (error) {
      console.error('Transactions.getHistoricalPriceBuy', error.stack);
    }
  }
}

/* 
// console.log('quantityRest', historicalPriceAgg.quantityRest)
// console.log('costBalance', historicalPriceAgg.costBalance)
// console.log('quantityInFlow', quantityInFlow)
// console.log('priceInFlow', priceInFlow)
// console.log('costInFlow', costInFlow)
// console.log('costRestInFlow', costRestInFlow)
// console.log('priceRestInFlow', priceRestInFlow)
*/

/**
 * CryptoRank instance
 */
class Instance$1 {
  /**
   * Create new inctance API CryptoRank
   */
  constructor() {
    if (Instance$1.exists) {
      return Instance$1.instance
    }
    Instance$1.instance = this;
    Instance$1.exists = true;
    this.methods = new Methods({
      domain: 'https://api.cryptorank.io/v1',
      query: {
        api_key: 'f512dfeb3966b63ac221826ab8501a53d96662a203ad786860d5cc268b85',
      },
      data: {
        muteHttpExceptions: true,
        contentType: 'application/json',
      },
    });
  }
}
/**
 * CryptoRank price
 */
class Price$1 {
  constructor() {
    this.methods = new Instance$1().methods;
  }
  getLastPrice(ids = '1', convert = 'USD') {
    return (
      this.methods.get({
        endPoint: '/currencies',
        query: {
          convert: convert,
          ids: ids,
        },
      })?.data || []
    )
  }

  getRank(id) {
    const data = this.methods.get({
      endPoint: '/currencies/{id}',
      path: { id },
    })?.data?.rank;
    return data
  }
}
/**
 * CryptoRank coin list
 */
class CoinsList$1 {
  constructor() {
    this.methods = new Instance$1().methods;
  }
  getCoinsList(limit = 100) {
    return (
      this.methods.get({
        endPoint: '/currencies',
        query: {
          convert: 'USD',
          state: 'active',
          limit: limit,
        },
      })?.data || []
    )
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
/**
 * CoinGecko price
 */
class Price {
  constructor() {
    this.methods = new Instance().methods;
  }

  /**
   *
   * @param {*} ids
   * @param {*} vs_currencies
   * @param {*} include_market_cap
   * @param {*} include_24hr_vol
   * @param {*} include_24hr_change
   * @param {*} include_last_updated_at
   * @returns
   */
  getSimplePrice(
    ids,
    vs_currencies,
    include_market_cap = false,
    include_24hr_vol = false,
    include_24hr_change = false,
    include_last_updated_at = false
  ) {
    return this.methods.get({
      endPoint: '/simple/price',
      query: {
        ids,
        vs_currencies,
        include_market_cap,
        include_24hr_vol,
        include_24hr_change,
        include_last_updated_at,
      },
    })
  }

  /**
   *
   * @param {*} ids
   * @param {*} vs_currency
   * @param {*} price_change_percentage
   * @returns
   */
  getMarketsPrice(
    ids,
    vs_currency = 'usd',
    price_change_percentage = '24h,7d,30d'
  ) {
    return (
      this.methods.get({
        endPoint: '/coins/markets',
        query: {
          vs_currency,
          ids,
          price_change_percentage,
        },
      }) || []
    )
  }
}
/**
 * CoinGecko coin list
 */
class CoinsList {
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
}

class Coins {
  constructor(workSheet = '') {
    if (Coins.exists) {
      return Coins.instance
    }
    Coins.instance = this;
    Coins.exists = true;
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Coins');
  }

  updateCoins() {
    new Promise((resolve, reject) => {
      const process = () => {
        const coins = [];
        new CoinsList().getCoinsList().forEach((coin) => {
          const rowKey = new Hash('coingecko' + coin.name + coin.symbol).md5;
          coins.push({
            rowKey: rowKey,
            source: 'coingecko',
            name: coin.name,
            symbol: coin.symbol,
            id: coin.id,
          });
        });

        new CoinsList$1().getCoinsList(15000).forEach((coin) => {
          const key = new Hash('cryptorank' + coin.name + coin.symbol);
          coins.push({
            rowKey: key.md5,
            source: 'cryptorank',
            name: coin.name,
            symbol: coin.symbol,
            id: coin.id,
          });
        });

        Object.entries(new CoinsList$2().getCoinsList()).forEach(
          (coin) => {
            const key = new Hash('cryptocompare' + coin[1].CoinName + coin[0]);
            coins.push({
              rowKey: key.md5,
              source: 'cryptocompare',
              name: coin[1].CoinName,
              symbol: coin[1].Symbol,
              id: coin[0],
            });
          }
        );
        const currency = [
          ['USA dollar', 'USD'],
          ['Russian rubble', 'RUB'],
          ['Euro', 'EUR'],
        ];
        currency.forEach((coin) => {
          const key = new Hash('cryptocompare' + coin[0] + coin[1]);
          coins.push({
            rowKey: key.md5,
            source: 'cryptocompare',
            name: coin[0],
            symbol: coin[1],
            id: coin[1],
          });
        });

        return { result: true, array: coins }
      };
      const data = process();
      resolve(data.array) ;
    })
      .then((array) => {
        this.workSheet.truncateInsertRows(array);
      })
      .catch((error) => {
        console.error('Coins.updateCoins', error.stack);
      });
  }
}

//* Deprecated
// new coinMarketCap.CoinsList().getCoinsList().forEach((coin) => {
//   const key = new Hash('coinmarketcap' + coin.name + coin.symbol)
//   coins.push({
//     rowKey: key.md5,
//     source: 'coinmarketcap',
//     name: coin.name,
//     symbol: coin.symbol,
//     id: coin.id,
//   })
// })

class Symbols {
  constructor(workSheet = '') {
    if (Symbols.exists) {
      return Symbols.instance
    }
    Symbols.instance = this;
    Symbols.exists = true;
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Symbols');
  }

  updateId() {
    try {
      const coins = new Coins().workSheet.object;
      this.workSheet.arrayOfObject.forEach((object) => {
        //* обновление ID
        const coinsKey = new Hash(object.source + object.name + object.symbol)
          .md5;
        const sourceId = coins[coinsKey]?.id || void 0;
        this.workSheet.insertValue(
          sourceId,
          object.rowNum,
          this.workSheet.head.sourceId.idx + 1
        );
      });
    } catch (error) {
      console.error('Symbols.updateId', error.stack);
    }
  }

  updatePrices() {
    new Promise((resolve, reject) => {
      const process = () => {
        /**
         * Обновление данных строки
         * @param {object} symbolObject
         * @param {number} price
         * @param {number} rank
         */
        const updatePricesRow = (
          symbolObject,
          price = void 0,
          rank = void 0
        ) => {
          new Promise((resolve) => {
            const process = () => {
              let coinMarketCapRankGroup = void 0;
              let rankNumber;
              rank ? (rankNumber = rank * 1) : (rankNumber = 100000);
              if (rankNumber <= 50) {
                coinMarketCapRankGroup = 'Top 50';
              } else if (rankNumber > 50 && rankNumber <= 100) {
                coinMarketCapRankGroup = 'Top 100';
              } else if (rankNumber > 100 && rankNumber <= 500) {
                coinMarketCapRankGroup = 'Top 500';
              } else if (rankNumber > 500 && rankNumber <= 1000) {
                coinMarketCapRankGroup = 'Top 1000';
              } else if (rankNumber > 1000 && rankNumber < 100000) {
                coinMarketCapRankGroup = 'Over 1000';
              } else {
                coinMarketCapRankGroup = 'Not rank group';
              }
              symbolObject.marketCapGroup = coinMarketCapRankGroup;
              symbolObject.price = price;
              symbolObject.update = new Date();
              return true
            };
            process() ? resolve() : reject(new Error('updatePricesRow'));
          }).catch((error) => {
            console.error('Symbols.updatePrices', error.stack);
          });
        };
        const listId = Object.fromEntries(
          Object.entries(
            this.workSheet.arrayOfObject.reduce((list, object) => {
              if (!list[object.source]) {
                list[object.source] = [];
              }
              if (
                object.sourceId &&
                new Hash(object.source).md5 !==
                  '8b9035807842a4e4dbe009f3f1478127' /*custom*/
              ) {
                list[object.source].push(object.sourceId);
              } else {
                list[object.source].push(object.symbol);
              }
              return list
            }, {})
          ).map(([source, idArray]) => [
            source,
            new Hash(source).md5 !==
            '8b9035807842a4e4dbe009f3f1478127' /*custom*/
              ? idArray.join(',')
              : idArray,
          ])
        );

        if (listId.coingecko) {
          const priceArray = new Price().getMarketsPrice(
            listId.coingecko
          );
          if (priceArray.length) {
            priceArray.forEach((coin) => {
              const symbolKey = new Hash(coin.symbol).md5;
              updatePricesRow(
                this.workSheet.object[symbolKey],
                coin?.current_price,
                coin?.market_cap_rank
              );
            });
          }
        }

        if (listId.cryptorank) {
          const priceArray = new Price$1().getLastPrice(
            listId.cryptorank
          );

          if (priceArray.length) {
            priceArray.forEach((coin) => {
              const symbolKey = new Hash(coin?.symbol).md5;
              updatePricesRow(
                this.workSheet.object[symbolKey],
                coin?.values?.USD?.price,
                coin?.rank
              );
            });
          }
        }

        if (listId.cryptocompare) {
          const priceArray = new Price$2().getMultiPrice(
            listId.cryptocompare
          );
          if (priceArray.length) {
            const marketCapRank = new TopList().topMarketCap(1000);

            priceArray.forEach((coin) => {
              const symbolKey = new Hash(coin.symbol).md5;
              updatePricesRow(
                this.workSheet.object[symbolKey],
                coin?.price,
                marketCapRank[symbolKey]?.rank
              );
            });
          }
        }
        // if (listId.custom.length) {
        //   const transactions = new Transactions()
        //   listId.custom.forEach((symbol) => {
        //     const historicalPricesAvg =
        //       transactions.getHistoricalPriceBuy(
        //         new Date(),
        //         'ikeniborn (speculative)',
        //         symbol,
        //         true
        //       ) || void 0

        //     this.updatePrice(symbol, historicalPricesAvg)
        //     this.updateRisk(symbol)
        //   })
        // }
        return true
      };
      process() ? resolve() : reject(new Error('updatePrices'));
    })
      .then(this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject))
      .catch((error) => {
        console.error('Symbols.updatePrices', error.stack);
      });
  }
}

//* Deprecated
//* Prices.updateId
// const coins = new Portfolio().getWorkSheet('coins').arrayOfObject
// const coin = coins.filter((row) => {
//   return (
//     new RegExp(object.name.toString().toLowerCase(), 'g').test(
//       row.name.toString().toLowerCase()
//     ) &&
//     new Hash(object.source).md5 === new Hash(row.source).md5 &&
//     new Hash(object.symbol).md5 === new Hash(row.symbol).md5
//   )
// })[0]
// this.workSheet.updateRow(object)
// this.workSheet.arrayOfObject.forEach((object) => {
//   //  this.workSheet.log.addMessage('Prices.updateId', 'object', object)
//   this.workSheet.updateRow(object)
// })
//* Prices.updatePrices
// if (listId.cryptorank) {
//   new cryptoRank.Price().getLastPrice(listId.cryptorank).forEach((coin) => {
//     updatePrice(coin.symbol, coin.values.USD.price)
//     updateRisk(coin.symbol, coin.rank)
//   })
// }
// if (listId.coinmarketcap) {
//   Object.values(
//     new coinMarketCap.Price().getLastPrice(listId.coinmarketcap)
//   ).forEach((coin) => {
//     updatePrice(coin.symbol, coin.quote.USD.price)
//     updateRisk(coin.symbol, coin.cmc_rank)
//   })
// }
// if (listId.custom.length) {
//   listId.custom.forEach((symbol) => {
//     const HistoricalPricesAvgKey = new Hash(
//       'ikeniborn' + 'no project' + symbol
//     ).md5
//     const histirocalPrice =
//       this.HistoricalPricesAvg[HistoricalPricesAvgKey]?.priceAvg ||
//       void 0
//     this.updatePrice(symbol, histirocalPrice)
//     this.updateRisk(symbol)
//   })
// }

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName());
  }

  /**
   * Получение счета
   * @param {string} accountSender счет отправителя
   * @param {string} accountRecipient счет получателя
   * @param {object} accounts справочник счетов
   * @param {string} symbolCategoryKey ключ категории символа
   * @returns счет
   */
  getAccount(accountSender, accountRecipient, accounts, symbolCategoryKey) {
    try {
      const account = accountRecipient ? accountRecipient : accountSender;
      if (
        [
          'e5e3fd01394b9a81296b75d5a7f4c1a2',
          '7d5f30a0d1641c0b6980aaf2556b32ce' /*stablecoin, fiat */,
        ].indexOf(symbolCategoryKey) !== -1
      ) {
        return accounts[new Hash(account).md5]?.mainAccount
      }
      return account
    } catch (error) {
      console.error('Registry.getAccount', error.stack);
    }
  }

  /**
   * Получаение основного счета
   * @param {string} account счет
   * @param {object} accounts справочник счетов
   * @returns основной счет
   */
  getMainAccount(account, accounts) {
    try {
      return accounts[new Hash(account).md5]?.mainAccount
    } catch (error) {
      console.error('Registry.getMainAccount', error.stack);
    }
  }

  /**
   * получение улюча категории символа
   * @param {*} symbol символ
   * @param {*} symbols справочник символов
   * @returns ключ категории символа
   */
  getSymbolCategoryKey(symbol, symbols) {
    try {
      return new Hash(symbols[new Hash(symbol).md5]?.symbolCategory).md5
    } catch (error) {
      console.error('Registry.getSymbolCategoryKey', error.stack);
    }
  }

  updateTransactions(isRange = false) {
    const startProcess = new FormatDate();
    try {
      const symbols = new Symbols().workSheet.object;
      const accounts = new Portfolio().getWorkSheet('Accounts').object;
      const transactions = new Transactions();
      const historicalPrice = new HistoricalPrice();
      const transactionsArrayOfObject = [];
      const updateDate = new Date();
      this.workSheet.arrayOfObject.forEach((rowValues) => {
        let coinQty,
          currencyQty,
          currencyPerCoin,
          coinSymbol,
          coinSymbolCategoryKey,
          symbolPrice,
          currencySymbol,
          currencySymbolCategoryKey,
          currencyPrice,
          accountSender,
          accountRecipient,
          mainAccountSender,
          mainAccountRecipient,
          sender,
          recipient,
          feeSender,
          feePrice,
          feeAccount,
          feeMainAccount,
          mainSymbol,
          feeCurrency,
          feeCurrencySymbolCategoryKey,
          feeQty,
          isDelete,
          isLiquidityPool,
          isFee,
          isLock,
          isSenderLock,
          isRecipientLock,
          isAvgPrice,
          isSymbolPrice,
          isCurencyPrice,
          isFeePrice,
          isHistoricalAveragePrice,
          isHistoricalAveragePriceSymbol,
          isHistoricalAveragePriceFeeCurrency,
          isHistoricalAveragePriceCurrency,
          operationKey,
          rowKey1,
          rowKey2,
          rowKey3,
          lockStatusKey,
          registryRowKey,
          registryRowKeyTimestamp,
          registryTimestamp;

        const transactionRow = [];
        const hhmm = new FormatNumber(
          rowValues.time
        ).getHourAndMinuteFromNumber();
        const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
          .date;
        registryRowKey = rowValues.rowKey;
        registryRowKeyTimestamp = rowValues.rowKeyTimestamp;
        registryTimestamp = rowValues.timestamp;
        operationKey = new Hash(rowValues.operation).md5;
        lockStatusKey = new Hash(rowValues.lockStatus).md5;
        coinQty =
          typeof rowValues.coinQty === 'number' ? rowValues.coinQty : void 0;

        currencyQty =
          typeof rowValues.currencyQty === 'number'
            ? rowValues.currencyQty
            : void 0;
        currencyPerCoin =
          typeof rowValues.currencyPerCoin === 'number'
            ? rowValues.currencyPerCoin
            : void 0;
        coinSymbol = rowValues.coin;
        coinSymbolCategoryKey = this.getSymbolCategoryKey(coinSymbol, symbols);
        currencySymbol = rowValues.currency || rowValues.coin;
        currencySymbolCategoryKey = this.getSymbolCategoryKey(
          currencySymbol,
          symbols
        );
        sender = rowValues.sender;
        recipient = rowValues.recipient ? rowValues.recipient : rowValues.sender;
        feeSender = rowValues.feeSender || rowValues.sender;
        feeCurrency = rowValues.feeCurrency;
        feeQty = rowValues.feeQty;
        isLiquidityPool = false;
        isDelete = rowValues.isDelete || false;
        isFee = false;
        isAvgPrice = false;
        isSenderLock = false;
        isRecipientLock = false;
        isSymbolPrice = false;
        isCurencyPrice = false;
        isFeePrice = false;
        isLock = false;
        isHistoricalAveragePriceSymbol = false;
        isHistoricalAveragePriceFeeCurrency = false;
        isHistoricalAveragePriceCurrency = false;

        //* Расчет пустых значений транзакции количества валюты за один токен, количество токена, количество валюты
        if (!currencyPerCoin && currencyQty) {
          currencyPerCoin = currencyQty / coinQty || void 0;
        }
        if (!currencyQty && currencyPerCoin) {
          currencyQty = coinQty * currencyPerCoin || void 0;
        }
        if (!coinQty) {
          coinQty = currencyQty / currencyPerCoin || void 0;
        }
        //* расчет пулов ликвидности
        if (
          [
            /*Liquidity pool (1), Liquidity pool (2), Liquidity pool (3)*/
            'd70311b68290664f7a442bfa8266dbb9',
            '0dc48f5ee42e5f36afa288473e6e1799',
            '4c110eef236fbdeffe3a353057692a58',
          ].indexOf(new Hash(rowValues.service).md5) !== -1
        ) {
          const countSymbolInLiquidityPool = coinSymbol.split(':').length - 1;
          coinQty /= countSymbolInLiquidityPool;
          mainSymbol = coinSymbol;
          isLiquidityPool = true;
        }

        //* расчета статуса блокировки для перемещений
        if (lockStatusKey === 'dce7c4174ce9323904a934a486c41288' /*lock*/) {
          isSenderLock = false;
          isRecipientLock = true;
        } else if (
          lockStatusKey === '474f3c5e4e32cc95d291d859ae64ef7b' /*unlock*/
        ) {
          isSenderLock = true;
          isRecipientLock = false;
        } else {
          isSenderLock = false;
          isRecipientLock = false;
        }
        //* формирование транзакций
        if (
          [
            /*Transfer, Write-off, Refill*/
            '84a0f3455dcca894ace136be62efa292',
            '7b33b9f52598cd60f7aa6ca0082515c4',
            'b4479040173a9f41eeb4e98339f2a21d',
          ].indexOf(operationKey) !== -1
        ) {
          currencyPerCoin = 1;
          // currencySymbol = coinSymbol
          if (
            [
              /*Write-off, Refill*/
              '7b33b9f52598cd60f7aa6ca0082515c4',
              'b4479040173a9f41eeb4e98339f2a21d',
            ].indexOf(operationKey) !== -1
          ) {
            isAvgPrice = true;
          }
          if (
            [
              /*Transfer, Write-off*/
              '84a0f3455dcca894ace136be62efa292',
              '7b33b9f52598cd60f7aa6ca0082515c4',
            ].indexOf(operationKey) !== -1
          ) {
            accountSender = this.getAccount(
              rowValues.accountSender,
              void 0,
              accounts,
              coinSymbolCategoryKey
            );
            mainAccountSender = this.getMainAccount(accountSender, accounts);
            rowKey1 = new Hash(rowValues.rowKey + '#1').md5;
            transactionRow.push({
              rowKey: rowKey1,
              direction: 'out',
              account: accountSender,
              mainAccount: mainAccountSender,
              contractor: sender,
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty * -1,
              isFee,
              isLock: isSenderLock,
              isLiquidityPool,
              isAvgPrice,
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
            });
          }
          if (
            [
              /*Transfer, Refill*/
              '84a0f3455dcca894ace136be62efa292',
              'b4479040173a9f41eeb4e98339f2a21d',
            ].indexOf(operationKey) !== -1
          ) {
            accountRecipient = this.getAccount(
              rowValues.accountSender,
              rowValues.accountRecipient,
              accounts,
              coinSymbolCategoryKey
            );
            mainAccountRecipient = this.getMainAccount(
              accountRecipient,
              accounts
            );
            rowKey2 = new Hash(rowValues.rowKey + '#2').md5;
            transactionRow.push({
              rowKey: rowKey2,
              direction: 'in',
              account: accountRecipient,
              mainAccount: mainAccountRecipient,
              contractor: recipient,
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty,
              isFee,
              isLock: isRecipientLock,
              isLiquidityPool,
              isAvgPrice: true,
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
            });
          }
        } else if (
          [/*buy*/ '0461ebd2b773878eac9f78a891912d65'].indexOf(operationKey) !==
          -1
        ) {
          accountSender = this.getAccount(
            rowValues.accountSender,
            void 0,
            accounts,
            currencySymbolCategoryKey
          );
          accountRecipient = this.getAccount(
            rowValues.accountSender,
            rowValues.accountRecipient,
            accounts,
            coinSymbolCategoryKey
          );
          mainAccountSender = this.getMainAccount(accountSender, accounts);
          mainAccountRecipient = this.getMainAccount(accountRecipient, accounts);
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5;
          transactionRow.push({
            rowKey: rowKey1,
            direction: 'out',
            account: accountSender,
            mainAccount: mainAccountSender,
            contractor: sender,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          });
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5;
          transactionRow.push({
            rowKey: rowKey2,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            mainAccount: mainAccountRecipient,
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: true,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          });
        } else if (
          [/*sell*/ '8325324b47e1e62a1c2998a640cbdc72'].indexOf(
            operationKey
          ) !== -1
        ) {
          accountSender = this.getAccount(
            rowValues.accountSender,
            void 0,
            accounts,
            coinSymbolCategoryKey
          );
          accountRecipient = this.getAccount(
            rowValues.accountSender,
            rowValues.accountRecipient,
            accounts,
            currencySymbolCategoryKey
          );

          mainAccountSender = this.getMainAccount(accountSender, accounts);
          mainAccountRecipient = this.getMainAccount(accountRecipient, accounts);
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5;
          transactionRow.push({
            rowKey: rowKey1,
            direction: 'out',
            account: accountSender,
            mainAccount: mainAccountSender,
            contractor: sender,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: true,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          });
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5;
          transactionRow.push({
            rowKey: rowKey2,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            mainAccount: mainAccountRecipient,
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          });
        }

        //* Расчет текущей или исторической цены покупаемого токена
        const historicalPriceBuyCoin = historicalPrice.getHistoricalPrice(
          dateTime,
          accountSender,
          sender,
          currencySymbol,
          currencySymbolCategoryKey,
          symbols,
          transactions.workSheet.arrayOfObject,
          isRange
        );

        isHistoricalAveragePriceCurrency =
          historicalPriceBuyCoin?.isHistoricalAveragePrice || false;
        isHistoricalAveragePriceSymbol =
          historicalPriceBuyCoin?.isHistoricalAveragePrice || false;
        currencyPrice = historicalPriceBuyCoin?.historicalPrice;
        symbolPrice = historicalPriceBuyCoin?.historicalPrice * currencyPerCoin;

        //* Комиссия
        if (rowValues.feeCurrency) {
          rowKey3 = new Hash(rowValues.rowKey + '#3').md5;
          feeCurrencySymbolCategoryKey = this.getSymbolCategoryKey(
            rowValues.feeCurrency,
            symbols
          );
          feeAccount = this.getAccount(
            rowValues.accountSender,
            void 0,
            accounts,
            feeCurrencySymbolCategoryKey
          );
          feeMainAccount = this.getMainAccount(feeAccount, accounts);
          if (
            'e5e3fd01394b9a81296b75d5a7f4c1a2' !==
            feeCurrencySymbolCategoryKey /*stablecoin*/
          ) {
            isAvgPrice = true;
          }
          transactionRow.push({
            rowKey: rowKey3,
            direction: 'out',
            account: feeAccount,
            mainAccount: feeMainAccount,
            contractor: feeSender,
            mainSymbol: void 0,
            symbol: feeCurrency,
            quantity: feeQty * -1,
            isFee: true,
            isLock: false,
            isLiquidityPool: false,
            isAvgPrice,
            isFeePrice: true,
            isSymbolPrice: false,
            isCurencyPrice: false,
          });

          //* Расчет текущей или исторической цены комиссии токена

          const historicalPriceBuyFee = historicalPrice.getHistoricalPrice(
            dateTime,
            feeAccount,
            feeSender,
            feeCurrency,
            feeCurrencySymbolCategoryKey,
            symbols,
            transactions.workSheet.arrayOfObject,
            isRange
          );

          feePrice = historicalPriceBuyFee?.historicalPrice;
          isHistoricalAveragePriceFeeCurrency =
            historicalPriceBuyFee?.isHistoricalAveragePrice;
        }

        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          let price;
          if (tx.isSymbolPrice) {
            price = symbolPrice;
            isHistoricalAveragePrice = isHistoricalAveragePriceSymbol;
          } else if (tx.isFeePrice) {
            price = feePrice;
            isHistoricalAveragePrice = isHistoricalAveragePriceFeeCurrency;
          } else if (tx.isCurencyPrice) {
            price = currencyPrice;
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency;
          }
          console.log(tx.account, tx.symbol, isHistoricalAveragePrice);
          const cost = tx.quantity * price;
          const object = {
            rowKey: tx.rowKey,
            sourceKey: new Hash(this.workSheet.sheetName).md5,
            sourceName: new Hash(this.workSheet.sheetName).stringLowerCase,
            historicalAveragePriceKey: new Hash(
              tx.account + tx.contractor + tx.symbol
            ).md5,
            dateTime: dateTime,
            direction: tx.isFee ? 'out' : tx.direction.toLowerCase(),
            operation: tx.isFee
              ? 'write-off'
              : rowValues.operation.toLowerCase(),
            account: tx.account.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            mainSymbol: tx.mainSymbol ? tx.mainSymbol.toLowerCase() : void 0,
            symbol: tx.symbol.toLowerCase(),
            quantity: tx.quantity,
            price: price || 0,
            cost: cost || 0,
            comment: rowValues.comment.toString().toLowerCase(),
            updateDate: updateDate,
            isDelete: isDelete,
            isAvgPrice: tx.isAvgPrice,
            isLiquidityPool: tx.isLiquidityPool,
            isFee: tx.isFee,
            isLock: tx.isLock,
            isHistoricalAveragePrice,
            registryRowKey,
            registryRowNum: rowValues.rowNum,
            registryRowId: rowValues.rowId,
          };

          //* вставка строки в транзакции
          const registryTimestampCache = this.workSheet.scriptCache.getCache(
            registryRowKeyTimestamp
          );

          if (
            registryTimestamp === registryTimestampCache ||
            !registryTimestampCache
          ) {
            transactionsArrayOfObject.push(object);
          }
        });
      });

      //* вставка даты сохранения
      new Promise((resolve) => {
        if (transactionsArrayOfObject.length) {
          transactions.updateTransactions(
            transactionsArrayOfObject,
            this.workSheet.isRange
          );
          const arrayRegistryRowNum = Object.values(
            transactionsArrayOfObject.reduce((array, row) => {
              if (!array[row.registryRowNum]) {
                array[row.registryRowNum] = {
                  rowNum: row.registryRowNum,
                  rowId: row.registryRowId,
                };
              }
              return array
            }, {})
          );
          resolve(arrayRegistryRowNum);
        }
      }).then((arrayRegistryRowNum) => {
        arrayRegistryRowNum.forEach((object) => {
          this.workSheet.insertRange(
            [
              [
                new FormatDate().getFormatDate('YYYY-MM-dd HH:mm:ss'),
                startProcess.getTimeDiff() + '',
                object.rowId,
              ],
            ],
            object.rowNum,
            this.workSheet.head.dateSaved.idx + 1
          );
        });
      });

      //* удаление пустых строк
      this.workSheet.deleteEmptyRows();
    } catch (error) {
      console.error('Registry.updateTransactions', error.stack);
    }
  }

  validateTransactions() {
    try {
      const transactions = new Transactions();
      const errorKeyArray = [];
      const sheetNameArray = this.workSheet.spreadSheet
        .getSheets()
        .map((sheet) => sheet.getName())
        .filter((sheetName) => sheetName.match('Registry'));

      sheetNameArray.forEach((sheetName) => {
        const workSheetRegistry = new Portfolio().getWorkSheet(sheetName);
        const workSheetObject = workSheetRegistry.object;
        const sourceKey = new Hash(sheetName).md5;

        const registryRowKeyArray = transactions.workSheet.arrayOfObject
          .filter((objectRow) => sourceKey === objectRow.sourceKey)
          .reduce((registryRowKeyArray, objectRow) => {
            if (!registryRowKeyArray.includes(objectRow.registryRowKey)) {
              registryRowKeyArray.push(objectRow.registryRowKey);
            }

            return registryRowKeyArray
          }, []);

        registryRowKeyArray.forEach((registryRowKey) => {
          if (!workSheetObject[registryRowKey]) {
            errorKeyArray.push(registryRowKey);
          }
        });

        workSheetRegistry.createFilter(workSheetRegistry.range);
      });
      //* удаление пустых ключей
      if (errorKeyArray.length) {
        const deletedTransactions = new Portfolio().getWorkSheet(
          'DeletedTransactions'
        );
        errorKeyArray.forEach((errorKey) => {
          const transactionsRowArray = transactions.workSheet.arrayOfObject.filter(
            (objectRow) => {
              return objectRow.registryRowKey === errorKey
            }
          );
          transactionsRowArray.forEach((row) => {
            deletedTransactions.arrayOfObject.push(
              transactions.workSheet.object[row.rowKey]
            );
            delete transactions.workSheet.object[row.rowKey];
          });
        });
        deletedTransactions.truncateInsertRows(
          deletedTransactions.arrayOfObject
        );
      }

      //* Удаление дубликатов и сортировка
      const newArrayOfObject = Object.values(transactions.workSheet.object)
        .filter((row) => {
          return !row.isDelete
        })
        .sort((a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        });
      transactions.workSheet.truncateInsertRows(newArrayOfObject);
    } catch (error) {
      console.error('Registry.validateTransactions', error.stack);
    }
  }
}

class LPToken {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('LPToken');
  }

  updateLPToken() {
    const transactionsLpToken = new Transactions().workSheet.arrayOfObject.filter(
      (row) =>
        [
          'd70311b68290664f7a442bfa8266dbb9',
          '0dc48f5ee42e5f36afa288473e6e1799',
          '4c110eef236fbdeffe3a353057692a58' /*liquidity pool (1), liquidity pool (2),liquidity pool (2)*/,
        ].indexOf(new Hash(row.service).md5) !== -1 &&
        new Hash(row.operation).md5 ===
          '0461ebd2b773878eac9f78a891912d65' /*'buy'*/ &&
        !row.isDelete
    );
    // console.log('transactionsLpToken', transactionsLpToken)
    const aggBalance = transactionsLpToken.reduce((object, tx) => {
      const positiveQuantity = tx.quantity < 0 ? tx.quantity * -1 : tx.quantity;
      if (!object[tx.account]) {
        object[tx.account] = {};
      }
      if (!object[tx.account]) {
        object[tx.account] = {};
      }
      if (!object[tx.account][tx.mainSymbol]) {
        object[tx.account][tx.mainSymbol] = [];
      }
      let part;
      if (new Hash(tx.mainSymbol).md5 === new Hash(tx.symbol).md5) {
        part = 'main';
      } else {
        if (
          new Hash(tx.service).md5 ===
          'd70311b68290664f7a442bfa8266dbb9' /*liquidity pool (1)*/
        ) {
          part = 'one';
        } else if (
          new Hash(tx.service).md5 ===
          '0dc48f5ee42e5f36afa288473e6e1799' /*liquidity pool (2)*/
        ) {
          part = 'two';
        } else if (
          new Hash(tx.service).md5 ===
          '4c110eef236fbdeffe3a353057692a58' /*liquidity pool (3)*/
        ) {
          part = 'three';
        }
      }
      object[tx.account][tx.mainSymbol].push({
        quantity: positiveQuantity,
        cost:
          new Hash(tx.mainSymbol).md5 === new Hash(tx.symbol).md5
            ? positiveQuantity * tx.price
            : 0,
        part: part,
        symbol: tx.symbol,
      });

      return object
    }, {});
    // console.log('aggBalance', aggBalance)
    const newArrayOfObject = [];
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([mainCoin, level1]) => {
        const aggMainCoin = level1.reduce((object, tx) => {
          if (!object[tx.part]) {
            object[tx.part] = {
              quantity: 0,
              cost: 0,
              symbol: tx.symbol || void 0,
            };
          }
          object[tx.part].quantity += tx.quantity;
          object[tx.part].cost += tx.cost;
          return object
        }, {});
        // console.log('aggMainCoin', aggMainCoin)
        let coeff = 1;
        if (aggMainCoin?.two?.coin && !aggMainCoin?.three?.coin) {
          coeff = 2;
        } else if (aggMainCoin?.two?.coin && aggMainCoin?.three?.coin) {
          coeff = 3;
        }
        newArrayOfObject.push({
          rowKey: new Hash(account + mainCoin).md5,
          account: account.toUpperCase(),
          mainSymbol: mainCoin.toUpperCase(),
          mainSymbolQty: aggMainCoin?.main?.quantity,
          mainSymbolHistoricalCost: aggMainCoin?.main?.cost,
          mainSymbolHistoricalPrice:
            aggMainCoin?.main?.cost / aggMainCoin?.main?.quantity,
          pairOneSymbol: aggMainCoin?.one?.symbol,
          pairOneQty: aggMainCoin?.one?.quantity,
          pairOnePrice:
            aggMainCoin?.main?.cost / coeff / aggMainCoin?.one?.quantity ||
            void 0,
          pairTwoSymbol: aggMainCoin?.two?.symbol,
          pairTwoQty: aggMainCoin?.two?.quantity,
          pairTwoPrice: aggMainCoin?.two?.symbol
            ? aggMainCoin?.main?.cost / coeff / aggMainCoin?.two?.quantity
            : void 0,
          pairThreeSymbol: aggMainCoin?.three?.symbol,
          pairThreeQty: aggMainCoin?.three?.quantity,
          pairThreePrice: aggMainCoin?.three?.symbol
            ? aggMainCoin?.three?.cost / coeff / aggMainCoin?.three?.quantity
            : void 0,
        });
      });
    });
    // console.log('newArrayOfObject', newArrayOfObject)
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }
}

class Flow {
  constructor(workSheet = '') {
    if (Flow.exists) {
      return Flow.instance
    }
    Flow.instance = this;
    Flow.exists = true;
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Flow');
  }

  updateFlow() {
    try {
      const symbols = new Symbols().workSheet.object;
      const contractors = new Portfolio().getWorkSheet('Contractors').object;
      const accounts = new Portfolio().getWorkSheet('Accounts').object;
      const inKey = new Hash('in').md5;
      const outKey = new Hash('out').md5;
      const aggFlow = new Transactions().workSheet.arrayOfObject
        .filter((row) => row.isDelete === false)
        .sort((a, b) => {
          return (
            new Date(a.dateTime).valueOf() +
            a.registryRowId -
            (new Date(b.dateTime).valueOf() + b.registryRowId)
          )
        })
        .reduce((agg, tx) => {
          const operationKey = new Hash(tx.operation).md5;
          const directionKey = new Hash(tx.direction).md5;
          const dayInPortfolio = new FormatDate().diffBetweenDate(tx.dateTime);
          if (!agg[tx.account]) {
            agg[tx.account] = {};
          }

          if (!agg[tx.account][tx.contractor]) {
            agg[tx.account][tx.contractor] = {};
          }

          if (!agg[tx.account][tx.contractor][tx.symbol]) {
            agg[tx.account][tx.contractor][tx.symbol] = {
              quantityBuyIn: 0,
              quantityBuyOut: 0,
              quantitySellIn: 0,
              quantitySellOut: 0,
              quantityRefillIn: 0,
              quantityWriteOffOut: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
              quantityRest: 0,
              quantityRestLock: 0,
              quantityRestUnlock: 0,
              costBuyIn: 0,
              costBuyOut: 0,
              costSellIn: 0,
              costSellOut: 0,
              costRefillIn: 0,
              costWriteOffOut: 0,
              costTransferIn: 0,
              costTransferOut: 0,
              costRest: 0,
              dayInPortfolioBuyInSum: 0,
              dayInPortfolioBuyOutSum: 0,
              dayInPortfolioSellOutSum: 0,
              dayInPortfolioSellInSum: 0,
              dayInPortfolioRefillInSum: 0,
              dayInPortfolioWriteOffOutSum: 0,
              dayInPortfolioTransferInSum: 0,
              dayInPortfolioTransferOutSum: 0,
            };
          }
          //* Распределение количества по потокам

          if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
            if (directionKey === inKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityBuyIn +=
                tx.quantity;
              agg[tx.account][tx.contractor][tx.symbol].costBuyIn += tx.cost;
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioBuyInSum += dayInPortfolio * tx.quantity;
            } else if (directionKey === outKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityBuyOut +=
                tx.quantity * -1;
              agg[tx.account][tx.contractor][tx.symbol].costBuyOut +=
                tx.cost * -1;
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioBuyOutSum += dayInPortfolio * tx.quantity * -1;
            }
          } else if (
            operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantitySellIn +=
                tx.quantity;
              agg[tx.account][tx.contractor][tx.symbol].costSellIn += tx.cost;
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioSellInSum += dayInPortfolio * tx.quantity;
            } else if (directionKey === outKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantitySellOut +=
                tx.quantity * -1;
              agg[tx.account][tx.contractor][tx.symbol].costSellOut +=
                tx.cost * -1;
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioSellOutSum += dayInPortfolio * tx.quantity * -1;
            }
          } else if (
            operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityRefillIn +=
                tx.quantity;
              agg[tx.account][tx.contractor][tx.symbol].costRefillIn += tx.cost;
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioRefillInSum += dayInPortfolio * tx.quantity;
            }
          } else if (
            operationKey === '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
          ) {
            if (directionKey === outKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityWriteOffOut +=
                tx.quantity * -1;
              agg[tx.account][tx.contractor][tx.symbol].costWriteOffOut +=
                tx.cost * -1;
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioWriteOffOutSum +=
                dayInPortfolio * tx.quantity * -1;
            }
          } else if (
            operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
          ) {
            if (directionKey === inKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityTransferIn +=
                tx.quantity;
              agg[tx.account][tx.contractor][tx.symbol].costTransferIn +=
                tx.cost;
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioTransferInSum += dayInPortfolio * tx.quantity;
            } else if (directionKey === outKey) {
              agg[tx.account][tx.contractor][tx.symbol].quantityTransferOut +=
                tx.quantity * -1;
              agg[tx.account][tx.contractor][tx.symbol].costTransferOut +=
                tx.cost * -1;
              agg[tx.account][tx.contractor][
                tx.symbol
              ].dayInPortfolioTransferOutSum +=
                dayInPortfolio * tx.quantity * -1;
            }
          }

          if (tx.isLock) {
            agg[tx.account][tx.contractor][tx.symbol].quantityRestLock +=
              tx.quantity;
          } else {
            agg[tx.account][tx.contractor][tx.symbol].quantityRestUnlock +=
              tx.quantity;
          }

          agg[tx.account][tx.contractor][tx.symbol].quantityRest += tx.quantity;
          agg[tx.account][tx.contractor][tx.symbol].costRest += tx.cost;

          return agg
        }, {});
      const aggFlowArrayOfObject = [];
      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([contractor, level1]) => {
          Object.entries(level1).forEach(([symbol, object]) => {
            //* доп. атрибуты
            //* атрибуты символа
            const symbolKey = new Hash(symbol).md5;
            const symbolFullName = symbols[symbolKey]?.name || '';
            const symbolCategory = symbols[symbolKey]?.symbolCategory || '';
            const symbolEcosystem = symbols[symbolKey]?.ecosystem || '';
            const symbolMarketCapGroup =
              symbols[symbolKey]?.marketCapGroup || '';
            const mainAccount = accounts[new Hash(account).md5].mainAccount;
            //* атрибуты контрагента
            const contractorKey = new Hash(contractor).md5;
            const contractorType = contractors[contractorKey]?.type || '';
            const contractorCategory =
              contractors[contractorKey]?.category || '';

            //* стоимость остатка
            const priceRest = symbols[symbolKey]?.price || 0;
            const costRest =
              Math.round(priceRest * object.quantityRest * 100) / 100;
            const costRestLock = priceRest * object.quantityRestLock;
            const costRestUnlock = priceRest * object.quantityRestUnlock;

            //* расчет потоков
            const costInFlow =
              object.costBuyIn +
              object.costSellIn +
              object.costRefillIn +
              object.costTransferIn;

            const costOwnInFlow =
              object.costBuyIn + object.costSellIn + object.costTransferIn;

            const costOutFlow =
              object.costBuyOut +
              object.costSellOut +
              object.costWriteOffOut +
              object.costTransferOut;

            const quantityInFlow =
              object.quantityBuyIn +
              object.quantitySellIn +
              object.quantityRefillIn +
              object.quantityTransferIn;

            const quantityOwnInFlow =
              object.quantityBuyIn +
              object.quantitySellIn +
              object.quantityTransferIn;

            const quantityOutFlow =
              object.quantityBuyOut +
              object.quantitySellOut +
              object.quantityWriteOffOut +
              object.quantityTransferOut;

            //* расчет цены потоков

            const priceInFlow = costInFlow / quantityInFlow;
            const priceOwnInFlow = costOwnInFlow / quantityOwnInFlow;
            const priceOutFlow = costOutFlow / quantityOutFlow;

            //* текущие остатки
            const costRestInFlow = object.costRest;
            const priceRestInFlow = object.costRest / object.quantityRest;

            // if (
            //   new Hash(contractor).md5 === new Hash('bybit').md5 &&
            //   new Hash(symbol).md5 === new Hash('btc').md5
            // ) {
            //   console.log(account, contractor, symbol)
            //   console.log('quantityRest', object.quantityRest)
            //   console.log('priceRestInFlow', priceRestInFlow)
            //   console.log('costRestInFlow', costRestInFlow)
            // }

            //* Расчет среднего времени в портфеле

            const dayInPortfolioAvg =
              object.dayInPortfolioBuyInSum / object.quantityBuyIn ||
              0 + object.dayInPortfolioSellInSum / object.quantitySellIn ||
              0 + object.dayInPortfolioRefillInSum / object.quantityRefillIn ||
              0 +
                object.dayInPortfolioTransferInSum /
                  object.quantityTransferIn ||
              -(
                object.dayInPortfolioBuyOutSum / object.quantityBuyOut ||
                0 + object.dayInPortfolioSellOutSum / object.quantitySellOut ||
                0 +
                  object.dayInPortfolioWriteOffOutSum /
                    object.quantityWriteOffOut ||
                0 +
                  object.dayInPortfolioTransferOutSum /
                    object.quantityTransferOut ||
                0
              );
            //* Количество на ребалансировки от изменения цены

            const priceFlow = priceRestInFlow;
            let quantityRebalance;
            if (priceRest) {
              const changePriceCoef = priceRest / priceFlow;
              const priceRebalance =
                priceRest + (priceFlow - priceRest) * changePriceCoef;

              quantityRebalance =
                (object.quantityRest * (priceFlow - priceRebalance)) /
                (priceRebalance - priceRest);
            } else {
              quantityRebalance = 0;
            }

            const payback = costOutFlow - costOwnInFlow;

            aggFlowArrayOfObject.push({
              mainAccount: mainAccount.toUpperCase(),
              account: account.toUpperCase(),
              contractor: contractor.toUpperCase(),
              contractorType: contractorType.toUpperCase(),
              contractorCategory: contractorCategory.toUpperCase(),
              symbol: symbol.toUpperCase(),
              symbolFullName: symbolFullName.toUpperCase(),
              symbolCategory: symbolCategory.toUpperCase(),
              symbolEcosystem: symbolEcosystem.toUpperCase(),
              symbolMarketCapGroup: symbolMarketCapGroup.toUpperCase(),
              quantityOwnInFlow: quantityOwnInFlow || 0,
              quantityInFlow: quantityInFlow || 0,
              quantityOutFlow: quantityOutFlow || 0,
              quantityRest: object.quantityRest || 0,
              quantityRestLock: object.quantityRestLock || 0,
              quantityRestUnlock: object.quantityRestUnlock || 0,
              priceOwnInFlow: priceOwnInFlow || 0,
              priceInFlow: priceInFlow || 0,
              priceOutFlow: priceOutFlow || 0,
              priceRestInFlow: priceRestInFlow || 0,
              priceRest: priceRest || 0,
              costOwnInFlow: costOwnInFlow || 0,
              costInFlow: costInFlow || 0,
              costOutFlow: costOutFlow || 0,
              costRest: costRest || 0,
              costRestInFlow: costRestInFlow || 0,
              costRestLock: costRestLock || 0,
              costRestUnlock: costRestUnlock || 0,
              pnlTotal: costOutFlow - costInFlow + costRest || 0,
              pnlRest: costRest - costRestInFlow || 0,
              quantityRebalance: quantityRebalance || 0,
              payback: payback || 0,
              dayInPortfolioAvg,
            });
          });
        });
      });

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject);
    } catch (error) {
      console.error('FlowSymbol.updateFlow', error.stack);
    }
  }
}

//* Deprecated
//* FlowSymbol.updateFlow
// quantityBuyIn: object.quantityBuyIn || 0,
// quantityBuyOut: object.quantityBuyOut || 0,
// quantitySellIn: object.quantitySellIn || 0,
// quantitySellOut: object.quantitySellOut || 0,
// quantityRefillIn: object.quantityRefillIn || 0,
// quantityWriteOffOut: object.quantityWriteOffOut || 0,
// quantityTransferIn: object.quantityTransferIn || 0,
// quantityTransferOut: object.quantityTransferOut || 0,
// priceBuy: priceBuy || 0,
// priceSell: priceSell || 0,
// priceRefill: priceRefill || 0,
// priceWriteOff: priceWriteOff || 0,
// priceTransferIn: priceTransferIn || 0,
// priceTransferOut: priceTransferOut || 0,
// costBuyIn: object.costBuyIn || 0,
// costBuyOut: object.costBuyOut || 0,
// costSellIn: object.costSellIn || 0,
// costSellOut: object.costSellOut || 0,
// costRefillIn: object.costRefillIn || 0,
// costWriteOffOut: object.costWriteOffOut || 0,
// costTransferIn: object.costTransferIn || 0,
// costTransferOut: object.costTransferOut || 0,

// import { GasProcess } from '../restApi/gasScriptApi'

function updateLPToken() {
  new LPToken().updateLPToken();
}

function cleanAllMetadata() {
  const activeWorkSheet = SpreadsheetApp.getActiveSheet();
  console.log('activeWorkSheet: ', activeWorkSheet.getName());
  new WorkSheetMetadata(activeWorkSheet).metadata.deleteAllMetadata();
}

function updateTransactions() {
  const startProcess = new FormatDate();
  try {
    new Registry().updateTransactions();
  } catch (error) {
    console.error('script.updateTransactions', error.stack);
  } finally {
    new Portfolio().log.addMessage(
      'updateTransactions',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    );
  }
}

function deleteDuplicatesRows() {
  const startProcess = new FormatDate();
  try {
    new Transactions().deleteDuplicatesRows();
  } catch (error) {
    console.error('script.deleteDuplicatesRows', error.stack);
  } finally {
    new Portfolio().log.addMessage(
      'deleteDuplicatesRows',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    );
  }
}

function updateCoins() {
  const startProcess = new FormatDate();
  try {
    new Coins().updateCoins();
  } catch (error) {
    console.error('script.updateCoins', error.stack);
  } finally {
    new Portfolio().log.addMessage(
      'updateCoins',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    );
  }
}

function updateDataMart() {
  const startProcess = new FormatDate();
  new Promise((resolve, reject) => {
    const process = () => {
      new Flow().updateFlow();
      return true
    };
    process() ? resolve() : reject(new Error('script.updateDataMart'));
  })
    .then(
      new Portfolio().log.addMessage(
        'script.updateDataMart',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updateDataMart', error.stack);
    });
}

function validateTransactions() {
  const startProcess = new FormatDate();
  new Promise((resolve, reject) => {
    const process = () => {
      new Registry().validateTransactions();
      return true
    };
    process() ? resolve() : reject(new Error('script.validateTransactions'));
  })
    // .then(
    //   new Portfolio().log.addMessage(
    //     'script.validateTransactions',
    //     'ID:' + startProcess.value,
    //     'Time spent: ' + startProcess.getTimeDiff()
    //   )
    // )
    .catch((error) => {
      console.error('script.validateTransactions', error.stack);
    });
}

function updatePrices() {
  const startProcess = new FormatDate();
  new Promise((resolve, reject) => {
    const process = () => {
      new Symbols().updatePrices();
      return true
    };
    process() ? resolve() : reject(new Error('script.updatePrices'));
  })
    .then(
      new Promise((resolve) => {
        new Registry().validateTransactions();
        resolve();
      }).then(new Flow().updateFlow())
    )
    .then(
      new Portfolio().log.addMessage(
        'updatePrices',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updatePrices', error.stack);
    });
}

function updateRegistryRowKey() {
  new Transactions().updateRegistryRowKey();
}

function updateHistoricalAveragePriceKey() {
  new Transactions().updateHistoricalAveragePriceKey();
}

function updateAccount() {
  new Transactions().updateAccount();
}

function recalculateTransactions() {
  new Transactions().recalculateTransactions(0, 1000);
}

function updateOnEdit(editRange) {
  try {
    const startProcess = new FormatDate();
    const lock = LockService.getScriptLock();
    new Promise((resolve) => {
      const workSheet = new Portfolio().updateOnEdit(editRange.range);
      if (workSheet.isChangeData) {
        const startLock = new FormatDate();
        lock.tryLock(180000);
        workSheet.lockTime = startLock.getTimeDiff();
        if (workSheet.isChangePrimaryKey) {
          workSheet.savePrimaryKeyChanges();
        }
        if (workSheet.workSheetKey === new Hash('symbols').md5) {
          new Symbols(workSheet).updateId();
        } else if (workSheet.isRegistry) {
          new Registry(workSheet).updateTransactions(true);
        }
        resolve(workSheet);
      }
    }).then((workSheet) => {
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
      );
      lock.releaseLock();
    });
  } catch (error) {
    console.error('script.updateOnEdit', error.stack);
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
  const activeSheet = SpreadsheetApp.getActiveSheet();
  const customFilter = activeSheet.getFilter();
  if (customFilter) {
    customFilter.remove();
  }
  const activeWorkSheet = new Portfolio().getWorkSheet(activeSheet.getName());
  if (activeWorkSheet.isRegistry) {
    const registry = new Registry(activeWorkSheet);
    const newArrayOfObject = registry.workSheet.arrayOfObject
      .filter((row) => {
        return row.rowKey
      })
      .map((row) => {
        const time = row.time || 2359;
        const date = row.date || new Date();
        const hhmm = new FormatNumber(time).getHourAndMinuteFromNumber();
        const DateTime = new FormatDate(date).addTime(hhmm.h, hhmm.m).date;
        row.dateTime = DateTime;
        return row
      })
      .sort((a, b) => {
        return ('' + a.coin).localeCompare(b.coin)
      })
      .sort((a, b) => {
        return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
      });

    registry.workSheet.truncateInsertRows(newArrayOfObject);
  }
}

function createMenu() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Portfolio');
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update data mart', 'updateDataMart')
      .addItem('Update current prices and data mart', 'updatePrices')
      .addItem('Validate transactions', 'validateTransactions')
      .addItem('Sort registry', 'sortRegistry')
    // .addItem('Clean all metadata in worksheet', 'cleanAllMetadata')
  );
  menu.addToUi();
}
