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
      this.stringLowerCase.replace(/[\s+]+$|^[\s+]+/g, '').trim()
    );
    for (let i = 0; i < digest.length; i++) {
      var val = (digest[i] + 256) % 256;
      hexstr += ('0' + val.toString(16)).slice(-2);
    }
    return hexstr
  }

  get uuid() {
    const uuidRx = new RegExp(/([a-zA-Z0-9]{8})([a-zA-Z0-9]{4})([a-zA-Z0-9]{4})([a-zA-Z0-9]{4})([a-zA-Z0-9]{12})/);
    return this.md5.replace(uuidRx, "$1-$2-$3-$4-$5")
  }

  uuidToMd5 (){
    return this.stringLowerCase.replace(/[-+]/g, '')
  }

  md5ToUuid (){
    const uuidRx = new RegExp(/([a-zA-Z0-9]{8})([a-zA-Z0-9]{4})([a-zA-Z0-9]{4})([a-zA-Z0-9]{4})([a-zA-Z0-9]{12})/);
    return this.stringLowerCase.replace(uuidRx, "$1-$2-$3-$4-$5")
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
   * Получение будущей даты на заданное количество дней
   * @param {number} day количество дней
   * @returns Дата
   */
  getNextDate(day) {
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
    return JSON.parse(JSON.stringify(this.object))
  }
}

class FormatArray {
  constructor(array = []) {
    this.array = array;
  }
  getCopy() {
    return JSON.parse(JSON.stringify(this.array))
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
          // генерация нового ключа
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
        // const rowNumData = new Hash(rowNum + this.sheetName)
        // const rowNumKey = rowNumData.md5
        const isChangeRow = this.isChangeRow(rowNum, arrayRow);
        // let rowIdCache
        let rowId;
        if (isChangeRow.sign) {
          let isNewRowId = false;
          const rowIdOld = arrayRow[this.head.rowId.idx] * 1;
          if (rowIdOld) {
            rowId = arrayRow[this.head.rowId.idx];
          } else {
            const maxRowId = this.workSheetMetadata.getMaxRowId();
            // rowIdCache = this.scriptCache.getCache(rowNumKey)
            // //* определение максимального идентификатора строки
            // if (rowIdCache > 0 && typeof rowIdCache === 'number') {
            //   rowId = rowIdCache
            // } else
            if (maxRowId > 0 && typeof maxRowId === 'number') {
              rowId = maxRowId + 1;
            } else {
              rowId = 1;
            }
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
                // if (!rowIdCache) {
                this.workSheetMetadata.addMaxRowId(rowId);
                // }
                // this.scriptCache.addCache(rowNumKey, rowId)
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
    let nKey = '';
    const nkeyArray = Object.keys(this.head)
      .filter((column) => this.head[column].pk)
      .sort((a, b) => { return this.head[a].idx - this.head[b].idx }) // сортировка
      .map((column) => {
        const value = rowObject[column];
        if (value instanceof Date) {
          return new Date(value).valueOf()
        } else {
          return value.toString().trim()
        }
      });
      
    if (nkeyArray.length > 1) {
      nKey = nkeyArray.join('#');
    } else {
      nKey = nkeyArray.join('');
    }
    return new Hash(nKey).md5
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

class Trigger {
  /**
   * Информация по триггерам
   */
  constructor() {
    this.sApp = ScriptApp;
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
  }
  getTriggerSourceName(triggerSource) {
    if (triggerSource == this.sApp.TriggerSource.CLOCK) {
      return 'CLOCK'
    } else if (triggerSource == this.sApp.TriggerSource.SPREADSHEETS) {
      return 'SPREADSHEETS'
    } else {
      return void 0
    }
  }

  get list() {
    const triggers = this.sApp.getProjectTriggers();
    return triggers.reduce((list, trigger) => {
      list[trigger.getUniqueId()] = {
        triggerId: trigger.getUniqueId(),
        sourceId: trigger.getTriggerSourceId(),
        handlerFunction: trigger.getHandlerFunction(),
        eventType: this.getEventName(trigger.getEventType()),
        triggerSource: this.getTriggerSourceName(trigger.getTriggerSource()),
      };
      return list
    }, {})
  }
}

class SpreadsheetsTrigger extends Trigger {
  /**
   * Создание триггера для таблиц Google
   * @param {object} ss объект книги
   */
  constructor(ss) {
    super();
    this.ss = ss;
    this.instance = this;
  }

  /**
   * Создание триггера при открытии
   * @param {string} functionName Название функции
   */
  createForSpreadsheetOnOpen(functionName) {
    this.sApp.newTrigger(functionName).forSpreadsheet(this.ss).onOpen().create();
    return this
  }
  /**
   * Создание триггера при редактировании электронной таблицы
   * @param {string} functionName Название функции
   */
  createForSpreadsheetOnEdit(functionName) {
    this.sApp.newTrigger(functionName).forSpreadsheet(this.ss).onEdit().create();
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
      .create();
    return this
  }

  createForSpreadsheetArter(functionName, seconds) {
    this.sApp
      .newTrigger(functionName)
      .timeBased()
      .after(seconds * 1000)
      .create();
    return this
  }

  deleteAllTrigger() {
    const triggers = this.sApp.getProjectTriggers();
    triggers.forEach((trigger) => this.sApp.deleteTrigger(trigger));
    return this
  }
  deleteDisabledTrigger() {
    const triggers = this.sApp.getProjectTriggers();
    triggers
      .filter((trigger) => {
        return trigger.isDisabled()
      })
      .forEach((disabledTrigger) => {
        this.sApp.deleteTrigger(disabledTrigger);
      });
    return this
  }
}

class ModalDialog {
  constructor(htmlTempate, width, height) {
    this.html = htmlTempate;
    this.width = width;
    this.height = height;
    this.ui = SpreadsheetApp.getUi();
  }

  showModalDialog(title) {
    const output = HtmlService.createTemplateFromFile(this.html)
      .evaluate()
      .setWidth(this.width)
      .setHeight(this.height);
    this.ui.showModalDialog(output, title);
  }

  closeModalDialog(title, timer = 200) {
    var output = HtmlService.createHtmlOutput(
      '<script>var myVar = setInterval(myTimer ,' +
      timer +
      ');function myTimer() { google.script.host.close();}</script>'
    )
      .setWidth(this.width)
      .setHeight(this.height);
    this.ui.showModalDialog(output, title);
  }

  alert(message) {
    this.ui.alert(message);
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
          portfolioSender: { alias: 'Portfolio (out)', idx: 1, notNull: true },
          accountRecipient: { alias: 'Account (in)', idx: 2 },
          portfolioRecipient: { alias: 'Portfolio (in)', idx: 3 },
          platform: { alias: 'Platform', idx: 4, notNull: true },
          service: { alias: 'Service', idx: 5, notNull: true },
          sender: { alias: 'Sender (out)', idx: 6, notNull: true },
          recipient: { alias: 'Recipient (in)', idx: 7 },
          lockStatus: { alias: 'Lock status', idx: 8 },
          coin: { alias: 'Coin', idx: 9, notNull: true },
          coinQty: { alias: 'Coin, qty', idx: 10 },
          coinPrice: { alias: 'Coin  price, $', idx: 11 },
          currency: { alias: 'Currency', idx: 12 },
          currencyQty: { alias: 'Currency, qty', idx: 13 },
          currencyPerCoin: { alias: 'Currency per coin', idx: 14 },
          currencyPrice: { alias: 'Currency  price, $', idx: 15 },
          feeSender: { alias: 'Fee sender (out)', idx: 16 },
          feeCurrency: { alias: 'Fee currency', idx: 17 },
          feeQty: { alias: 'Fee, qty', idx: 18 },
          comment: { alias: 'Comment', idx: 19 },
          date: {
            alias: 'Date (yyyy-MM-dd)',
            idx: 20,
            notNull: true,
            type: 'date',
            default: void 0,
          },
          time: { alias: 'Time (HHmm)', idx: 21, notNull: true },
          isDelete: { alias: 'Is delete', idx: 22 },
          dateSaved: {
            alias: 'Date saved',
            idx: 23,
            type: 'date',
            default: new Date(),
          },
          timeSpent: {
            alias: 'Time spent (hh:mm:ss)',
            idx: 24,
            type: 'string',
          },
          rowId: { alias: 'Row ID', idx: 25, notNull: true },
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
            alias: 'Name',
            idx: 2,
            notNull: true,
          },
          symbol: {
            alias: 'Symbol',
            idx: 3,
            pk: true,
            notNull: true,
          },
          symbolCategory: {
            alias: 'Symbol category ',
            idx: 4,
          },
          sourceId: { alias: 'Source id', idx: 5, },
          price: { alias: 'Price', idx: 6 },
          useInReport: { alias: 'Use in report', idx: 7 },
          update: {
            alias: 'Update',
            idx: 8,
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
          accountKey: { alias: 'Account key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          account: { alias: 'Account', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          portfolio: { alias: 'Portfolio', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          overflow: { alias: 'Overflow', idx: 11 },
          overflowRev: { alias: 'Overflow rev', idx: 12 },
          mainSymbol: { alias: 'Main coin', idx: 13 },
          symbol: { alias: 'Coin', idx: 14 },
          quantity: { alias: 'Quantity', idx: 15 },
          price: { alias: 'Price', idx: 16 },
          priceCoef: { alias: 'Price coef', idx: 17 },
          priceCoefRev: { alias: 'Price coef rev', idx: 18 },
          cost: { alias: 'Cost', idx: 19 },
          priceBTC: { alias: 'Price BTC', idx: 20 },
          costBTC: { alias: 'Cost BTC', idx: 21 },
          comment: { alias: 'Comment', idx: 22 },
          isDelete: { alias: 'Delete', idx: 23 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 24 },
          isFee: { alias: 'Is fee', idx: 25 },
          isLock: { alias: 'Is lock', idx: 26 },
          isAvgPrice: { alias: 'Is average price', idx: 27 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 28,
          },
          isOverflow: { alias: 'Is overflow', idx: 29 },
          registryRowId: { alias: 'Registry row id', idx: 30 },
          registryRowKey: { alias: 'Registry row key', idx: 301 },
          updateDate: {
            alias: 'Update date',
            idx: 32,
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
          accountKey: { alias: 'Account key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          account: { alias: 'Account', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          portfolio: { alias: 'Portfolio', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          overflow: { alias: 'Overflow', idx: 11 },
          overflowRev: { alias: 'Overflow rev', idx: 12 },
          mainSymbol: { alias: 'Main coin', idx: 13 },
          symbol: { alias: 'Coin', idx: 14 },
          quantity: { alias: 'Quantity', idx: 15 },
          price: { alias: 'Price', idx: 16 },
          priceCoef: { alias: 'Price coef', idx: 17 },
          priceCoefRev: { alias: 'Price coef rev', idx: 18 },
          cost: { alias: 'Cost', idx: 19 },
          priceBTC: { alias: 'Price BTC', idx: 20 },
          costBTC: { alias: 'Cost BTC', idx: 21 },
          comment: { alias: 'Comment', idx: 22 },
          isDelete: { alias: 'Delete', idx: 23 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 24 },
          isFee: { alias: 'Is fee', idx: 25 },
          isLock: { alias: 'Is lock', idx: 26 },
          isAvgPrice: { alias: 'Is average price', idx: 27 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 28,
          },
          isOverflow: { alias: 'Is overflow', idx: 29 },
          registryRowId: { alias: 'Registry row id', idx: 30 },
          registryRowKey: { alias: 'Registry row key', idx: 301 },
          updateDate: {
            alias: 'Update date',
            idx: 32,
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
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: {
            alias: 'Row key', idx: 0, pk: true,
            notNull: true
          },
          account: { alias: 'Account', idx: 1 },
          portfolio: { alias: 'Portfolio', idx: 2 },
          contractor: { alias: 'Contractor', idx: 3 },
          contractorType: { alias: 'Contractor type', idx: 4 },
          contractorCategory: { alias: 'Contractor category', idx: 5 },
          symbol: { alias: 'Symbol name', idx: 6 },
          symbolFullName: { alias: 'Symbol full name', idx: 7 },
          symbolCategory: { alias: 'Symbol category', idx: 8 },
          symbolType: { alias: 'Symbol type', idx: 9 },
          // quantityBuy: { alias: 'Quantity (buy)', idx: 12 },
          // quantitySell: { alias: 'Quantity (sell)', idx: 13 },
          // quantityTransfer: { alias: 'Quantity (transfer)', idx: 12 },
          quantityInvest: { alias: 'Quantity (invest)', idx: 10 },
          quantityOverflow: { alias: 'Quantity (overflow)', idx: 11 },
          // quantityIn: { alias: 'Quantity (in)', idx: 12 },
          // quantityOut: { alias: 'Quantity (out)', idx: 13 },
          quantityRest: { alias: 'Quantity (rest)', idx: 12 },
          quantityLock: { alias: 'Quantity (lock)', idx: 13 },
          quantityRebalance: { alias: 'Quantity (rebalance)', idx: 14 },
          // quantityUnlock: { alias: 'Quantity (unlock)', idx: 14 },
          // priceIn: { alias: 'Price (in), $', idx: 19 },
          // priceOut: { alias: 'Price (out), $', idx: 19 },
          // priceInvest: { alias: 'Price (invest), $', idx: 19 },
          priceRestOverflow: { alias: 'Price (rest overflow), $', idx: 15 },
          priceRestWoOverflow: { alias: 'Price (rest without overflow), $', idx: 15 },
          priceRest: { alias: 'Price (rest), $', idx: 15 },
          priceLast: { alias: 'Price (last), $', idx: 16 },
          // costBuyIn: { alias: 'Cost (buy in), $', idx: 24 },
          // costBuyOut: { alias: 'Cost (buy out), $', idx: 25 },
          // costRefillIn: { alias: 'Cost (refill in), $', idx: 33 },    
          // costSellIn: { alias: 'Cost (sell in), $', idx: 26 },
          // costSellOut: { alias: 'Cost (sell out), $', idx: 27 },
          // costWriteOffOut: { alias: 'Cost (write-off out), $', idx: 34 },
          // costSell: { alias: 'Cost (sell), $', idx: 23 },
          // costTransferIn: { alias: 'Cost (transfer in), $', idx: 28 },
          // costTransferOut: { alias: 'Cost (transfer out), $', idx: 29 },
          // costTransfer: { alias: 'Cost (transfer), $', idx: 22 },
          // costOverflowIn: { alias: 'Cost (overflow in), $', idx: 30 },
          // costOverflowOut: { alias: 'Cost (overflow out), $', idx: 31 },
          // costOverflow: { alias: 'Cost (overflow), $', idx: 32 },
          // costIn: { alias: 'Cost (in), $', idx: 21 },
          // costOut: { alias: 'Cost (out), $', idx: 21 },
          costInvest: { alias: 'Cost (invest), $', idx: 17 },
          costRest: { alias: 'Cost (rest), $', idx: 18 },
          costLast: { alias: 'Cost (last), $', idx: 19 },
          costLock: { alias: 'Cost (lock), $', idx: 20 },
          costTotal: { alias: 'Cost (total), $', idx: 21 },
          costRealized: { alias: 'Cost (realized), $', idx: 22 },
          // costUnlock: { alias: 'Cost (unlock), $', idx: 38 },
          pnlRealized: { alias: 'PnL (realized), $', idx: 23 },
          pnlUnrealized: { alias: 'PnL (unrealized), $', idx: 24 },
          pnlTotal: { alias: 'PnL (total), $', idx: 25 },
          // dayInPortfolioAvg: {
          //   alias: 'Average day in portfolio',
          //   idx: 44,
          // },
          isSell: { alias: 'Is sell', idx: 26, default: 0 },
          useInReport: { alias: 'Use in report', idx: 27, default: 1 },
          updateDate: {
            alias: 'Update date',
            idx: 28,
            type: 'date',
            default: new Date()
          }
        },
      },
      flowBalance: {
        type: 'dim',
        rowNum: 1,
        columns: {
          id: { alias: 'ID', idx: 0 },
          account: { alias: 'Account', idx: 1 },
          portfolio: { alias: 'Porfolio', idx: 2 },
          target: {
            alias: 'Target',
            idx: 3,
          },
          coin: {
            alias: 'Coin',
            idx: 4,
          },
          currency: {
            alias: 'Currency',
            idx: 4,
          },
          currency: {
            alias: 'Currency',
            idx: 4,
          },
          updateDate: {
            alias: 'Update date',
            idx: 5,
          },
          rowId: { alias: 'Row ID', idx: 6, default: 0 },
        },
      },
      plan: {
        type: 'dim',
        rowNum: 1,
        columns: {
          planId: { alias: 'ID', idx: 0 },
          account: { alias: 'Account', idx: 1 },
          portfolio: { alias: 'Portfolio', idx: 2 },
          target: { alias: 'Target', idx: 3 },
          coin: { alias: 'Coin', idx: 4 },
          currency: { alias: 'Currency', idx: 5 },
          currencyPerCoin: { alias: 'Currency per coin', idx: 6 },
          Comment: { alias: 'Comment', idx: 7 },
          createDate: { alias: 'Create date', idx: 8,type: 'date', },
          updateDate: { alias: 'Update date', idx: 9,type: 'date', },
          isDelete: { alias: 'Is delete', idx: 10 },
        },
      },
      overflows: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          dayInOverflowAvg: {
            alias: 'Day in overflow (avg)',
            idx: 1,
          },
          dayInBackFlowAvg: { alias: 'Day in backflow (avg)', idx: 2 },
          dayInFlowAvg: {
            alias: 'Day in flow (avg)',
            idx: 3,
          },
          overflow: { alias: 'Overflow', idx: 4 },
          backflow: { alias: 'Backflow', idx: 5 },
          ABPriceCoefFlow: { alias: 'A/B price coef overflow', idx: 6 },
          // ABPriceCoefRest: { alias: 'A/B price coef overflow (rest)', idx: 7 },
          ABPriceCoef: { alias: 'A/B price coef', idx: 7 },
          ABPriceCoefDiffPct: { alias: 'A/B price coef diff, %', idx: 8 },
          // ABPriceCoefRestDiffPct: { alias: 'A/B price coef diff (rest), %', idx: 10 },
          overflowStatus: { alias: 'Overflow status', idx: 9 },
          // overflowStatusRest: { alias: 'Overflow status (rest)', idx: 12 },
          tokenA: { alias: 'Token A', idx: 10 },
          tokenARestQuantity: { alias: 'Token A rest, qty', idx: 11 },
          tokenAOverFlowQuantity: { alias: 'Token A overflow, qty', idx: 12 },
          tokenABackFlowMaxPlanQuantity: {
            alias: 'Token A backflow max (plan), qty',
            idx: 13,
          },
          tokenABackFlowQuantity: {
            alias: 'Token A backflow, qty',
            idx: 14,
          },
          tokenAOverflowCostFreeze: {
            alias: 'Token A overflow cost freeze, $',
            idx: 15,
          },
          tokenAOverflowPnlQty: { alias: 'Token A overflow PnL, qty', idx: 16 },
          // tokenAOverflowPnlRestQty: { alias: 'Token A overflow PnL (rest), qty', idx: 20 },
          tokenAOverflowPnlQtyPct: {
            alias: 'Token A overflow PnL (qty), %',
            idx: 17,
          },
          // tokenAOverflowPnlRestQtyPct: {
          //   alias: 'Token A overflow PnL (rest) (qty), %',
          //   idx: 22,
          // },
          tokenB: { alias: 'Token B', idx: 18 },
          tokenBRestQuantity: { alias: 'Token B rest, qty', idx: 19 },
          tokenBOverFlowQuantity: { alias: 'Token B overflow, qty', idx: 20 },
          // tokenBBackFlowQuantity: { alias: 'Token B backflow, qty', idx: 21 },
          tokenBBackFlowMinPlanQuantity: {
            alias: 'Token B backflow min (plan), qty',
            idx: 22,
          },
          rowId: { alias: 'Row ID', idx: 23, default: 0 },
          updateDataMart: {
            alias: 'Update data mart',
            idx: 24,
            type: 'date',
          },
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
      planType: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      planTarget: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
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
      portfolios: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      blockchains: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      accounts: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
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
          portfolio: { alias: 'Portfolio', pk: true, idx: 2, notNull: true },
          mainSymbol: { alias: 'Main symbol', pk: true, idx: 3, notNull: true },
          mainSymbolQty: {
            alias: 'Main symbol qty',
            idx: 4,
          },
          mainSymbolHistoricalCost: {
            alias: 'Main symbol historical cost',
            idx: 5,
          },
          mainSymbolHistoricalPrice: {
            alias: 'Main symbol historical price',
            idx: 6,
          },
          pairOneSymbol: { alias: 'Pair one symbol', idx: 7 },
          pairOneQty: { alias: 'Pair one qty', idx: 8 },
          pairOnePrice: { alias: 'Pair one price', idx: 9 },
          pairTwoSymbol: { alias: 'Pair one symbol', idx: 10 },
          pairTwoQty: { alias: 'Pair two qty', idx: 11 },
          pairTwoPrice: { alias: 'Pair two price', idx: 12 },
          pairThreeSymbol: { alias: 'Pair three symbol', idx: 13 },
          pairThreeQty: { alias: 'Pair three qty', idx: 14 },
          pairThreePrice: { alias: 'Pair three price', idx: 15 },
          update: {
            alias: 'Update',
            idx: 16,
            type: 'date',
            default: new Date(),
          },
        },
      },
    };
    this.spreadSheetName = 'portfolio';
    this.log = new Log(this.spreadSheetName);
  }

  getAccountsKey() {
    const head = new Header().getHead(this.workSheetHeads, 'Accounts');
    const workSheet = new WorkSheet(
      this.spreadSheetName,
      'Accounts',
      head
    ).getDataset();
    return workSheet.arrayOfObject.map((rowObject) => rowObject.rowKey)
  }

  getWorkSheet(sheetName) {
    try {
      let headSheetName, isRegistry;
      headSheetName = sheetName;
      isRegistry = false;
      const accountsKey = this.getAccountsKey();
      if (accountsKey.indexOf(new Hash(sheetName).md5) !== -1) {
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
      const accountsKey = this.getAccountsKey();
      if (accountsKey.indexOf(new Hash(sheetName).md5) !== -1) {
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
//     costPayback: { alias: 'Payback', idx: 22 },
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
        ms: 50,
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
        if (stepResult.iteration > 3) {
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
 * CryptoRank instance
 */
class Instance$4 {
  /**
   * Create new inctance API CryptoRank
   */
  constructor() {
    if (Instance$4.exists) {
      return Instance$4.instance
    }
    Instance$4.instance = this;
    Instance$4.exists = true;
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
class Price$4 {
  constructor() {
    this.methods = new Instance$4().methods;
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
class CoinsList$3 {
  constructor() {
    this.methods = new Instance$4().methods;
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
 * CryptoCompare instance
 */
class Instance$3 {
  /**
   * Create new inctance API CryptoCompare
   *
   */
  constructor() {
    if (Instance$3.exists) {
      return Instance$3.instance
    }
    Instance$3.instance = this;
    Instance$3.exists = true;
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
class Price$3 {
  constructor() {
    this.methods = new Instance$3().methods;
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
    this.methods = new Instance$3().methods;
  }
  getCoinsList() {
    return this.methods.get({ endPoint: '/all/coinlist' })?.Data
  }
}

class TopList {
  constructor() {
    this.methods = new Instance$3().methods;
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

/**
 * CoinMarketCap instance
 */
class Instance$2 {
  constructor() {
    if (Instance$2.exists) {
      return Instance$2.instance
    }
    Instance$2.instance = this;
    Instance$2.exists = true;
    this.methods = new Methods({
      domain: 'https://pro-api.coinmarketcap.com',
      data: {
        muteHttpExceptions: true,
        contentType: 'accept: application/json',
        headers: {
          'X-CMC_PRO_API_KEY': '133c18b7-555c-4e57-ad7b-4d2bf6160c20',
        },
      },
    });
  }
}
/**
 * CoinMarketCap Price
 */
class Price$2 {
  constructor() {
    this.methods = new Instance$2().methods;
  }
  /**
   * Get last price
   *
   * @param {*} id
   * @param {*} convert
   * @returns {array}
   */
  getLastPrice(id = '1', convert = 'USD') {
    return this.methods.get({
      endPoint: '/v2/cryptocurrency/quotes/latest',
      query: {
        id,
        convert,
      },
    })?.data
  }
}
/**
 * CoinMarketCap coin list
 */
class CoinsList$1 {
  constructor() {
    this.methods = new Instance$2().methods;
  }
  /**
   * Get coins list
   *
   * @returns array coin
   */
  getCoinsList() {
    return this.methods.get({
      endPoint: '/v1/cryptocurrency/map',
    })?.data
  }
}

class Category {
  constructor() {
    this.methods = new Instance$2().methods;
  }
  /**
   * Get coins list
   *
   * @returns category
   */
  getCategory(id) {
    const object = this.methods.get({
      endPoint: '/v2/cryptocurrency/info',
      query: {
        id,
      },
    })?.data;
    return object[id]?.tags.join(', ')
  }
  getCategories() {
    const object = this.methods.get({
      endPoint: '/v1/cryptocurrency/categories',
    })?.data;
    return object
  }
}

/**
 * CoinGecko instance
 */
class Instance$1 {
  /**
   * Create new inctance API CoinGecko
   */
  constructor() {
    if (Instance$1.exists) {
      return Instance$1.instance
    }
    Instance$1.instance = this;
    Instance$1.exists = true;
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
class Price$1 {
  constructor() {
    this.methods = new Instance$1().methods;
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
    this.methods = new Instance$1().methods;
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

/**
 * CoinMarketCap instance
 */
class Instance {
  constructor() {
    if (Instance.exists) {
      return Instance.instance
    }
    Instance.instance = this;
    Instance.exists = true;
    this.methods = new Methods({
      domain: 'https://web-app-backend.w3s-crm.com/api/v1',
      data: {
        muteHttpExceptions: true,
        contentType: 'accept: application/json',
        headers: {
          'X-API-Key': 'w3s-api-8QUmPH9Uq1mXGWCQayKnQaFQawQiDaxtpDi1iC4go3aT1v7ZRq0TGc57',
        },
      },
    });
  }
}
/**
 * CoinMarketCap Price
 */
class Price {
  constructor() {
    this.methods = new Instance().methods;
  }

  /**
   * Get last price
   *
   * @param {*} token_id
   * @returns {array}
   */
  getLastPrice(token_id = 'b460f578-b1ce-950c-287e-dc61d0728e51') {
    return this.methods.get({
      endPoint: '/token/latest',
      query: {
        token_id,
      },
    })?.data || []
  }

  /**
   * Get historical price
   *
   * @param {*} token_id
   * @returns {array}
   */
  getHistoricalPrice(token_id = 'b460f578-b1ce-950c-287e-dc61d0728e51', from = new Date(), to = new Date()) {
    const fromFormat = new FormatDate(from).getFormatDate('yyyy-MM-dd');
    const toFormat = new FormatDate(to).getFormatDate('yyyy-MM-dd');
    const array = this.methods.get({
      endPoint: '/token/historical',
      query: {
        token_id,
        from: fromFormat,
        to: toFormat,
      },
    })?.data || [];
    return array
  }

  /**
 * Gettoken search
 *
 * @param {*} token_id
 * @returns {array}
 */
  getTokenSearch(token_id = 'b460f578-b1ce-950c-287e-dc61d0728e51') {
    return this.methods.get({
      endPoint: '/token/search',
      query: {
        token_id,
      },
    })?.data || []
  }

  
  /**
 * Gettoken search
 *
 * @param {*} token_id
 * @returns {array}
 */
  getTokenSearch2(token_id = 'b460f578-b1ce-950c-287e-dc61d0728e51') {
    return this.methods.get({
      endPoint: '/token/search2',
      query: {
        token_id,
      },
    })?.data || []
  }
}

class Dimension {
  constructor() {
    this.methods = new Instance().methods;
  }
  /**
   * Get last price
   *
   * @param {*} token_id
   * @returns {array}
   */
  getDimension(token_id = 'b460f578-b1ce-950c-287e-dc61d0728e51') {
    return this.methods.get({
      endPoint: '/token/dimension',
      query: {
        token_id,
      },
    })?.data || []
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

        new CoinsList$3().getCoinsList(20000).forEach((coin) => {
          const key = new Hash('cryptorank' + coin.name + coin.symbol);
          coins.push({
            rowKey: key.md5,
            source: 'cryptorank',
            name: coin.name,
            symbol: coin.symbol,
            id: coin.id,
          });
        });

        new CoinsList$1().getCoinsList().forEach((coin) => {
          const key = new Hash('coinmarketcap' + coin.name + coin.symbol);
          coins.push({
            rowKey: key.md5,
            source: 'coinmarketcap',
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
        let sourceId = void 0;
        let symbolCategory = void 0;
        if (new Hash(object.source).md5 == '9fcc5acecc1e69fad95aa3fec1b715c6' /*web3space*/) {
          const tokenId = new Hash([object.name, object.symbol].join('#')).uuid;
          const coinsObject = new Dimension().getDimension(tokenId).reduce((object, value) => {
            if (!object[value.token_id]) {
              object[value.token_id] = value;
            }
            return object
          }, {});
          sourceId = coinsObject[tokenId]?.token_id || void 0;
          symbolCategory = coinsObject[tokenId]?.token_category_name_en || void 0;
        } else {
          const coinsKey = new Hash(object.source + object.name + object.symbol).md5;
          sourceId = coins[coinsKey]?.id || void 0;
          symbolCategory = object.symbolCategory || void 0;
        }
        this.workSheet.insertValue(
          sourceId,
          object.rowNum,
          this.workSheet.head.sourceId.idx + 1
        );
        this.workSheet.insertValue(
          symbolCategory,
          object.rowNum,
          this.workSheet.head.symbolCategory.idx + 1
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
         * @param {number} updatedDttm
         */
        const updatePricesRow = (
          symbolObject = {},
          price = void 0,
          rank = void 0,
          updatedDttm = new Date()
        ) => {
          new Promise((resolve) => {
            const process = () => {
              let coinMarketCapRankGroup = 'Not rank group';
              let coinPriceGroup = 'Not price group';
              let rankNumber;
              //* определение группы по капитализации
              rank ? (rankNumber = rank * 1) : (rankNumber = 100000);
              if (rankNumber <= 50) {
                coinMarketCapRankGroup = 'Top 50';
              } else if (rankNumber > 50 && rankNumber <= 100) {
                coinMarketCapRankGroup = 'Top 100';
              } else if (rankNumber > 100 && rankNumber <= 200) {
                coinMarketCapRankGroup = 'Top 200';
              } else if (rankNumber > 200 && rankNumber <= 300) {
                coinMarketCapRankGroup = 'Top 300';
              } else if (rankNumber > 300 && rankNumber <= 400) {
                coinMarketCapRankGroup = 'Top 400';
              } else if (rankNumber > 400 && rankNumber <= 500) {
                coinMarketCapRankGroup = 'Top 500';
              } else if (rankNumber > 500 && rankNumber <= 1000) {
                coinMarketCapRankGroup = 'Top 1000';
              } else if (rankNumber > 1000 && rankNumber < 100000) {
                coinMarketCapRankGroup = 'Over 1000';
              }
              //* определение группы по цене

              if (price > 0 && price <= 1) {
                coinPriceGroup = 'Price 0-1';
              } else if (price > 1 && price <= 2) {
                coinPriceGroup = 'Price 1-2';
              } else if (price > 2 && price <= 4) {
                coinPriceGroup = 'Price 2-4';
              } else if (price > 4 && price <= 8) {
                coinPriceGroup = 'Price 4-8';
              } else if (price > 8 && price <= 16) {
                coinPriceGroup = 'Price 8-16';
              } else if (price > 16 && price <= 32) {
                coinPriceGroup = 'Price 16-32';
              } else if (price > 32 && price <= 64) {
                coinPriceGroup = 'Price 32-64';
              } else if (price > 64 && price <= 128) {
                coinPriceGroup = 'Price 64-128';
              } else if (price > 128 && price <= 256) {
                coinPriceGroup = 'Price 128-256';
              } else if (price > 256 && price <= 512) {
                coinPriceGroup = 'Price 256-512';
              } else if (price > 512) {
                coinPriceGroup = 'Over 512';
              }

              symbolObject.priceGroup = coinPriceGroup;
              symbolObject.marketCapGroup = coinMarketCapRankGroup;
              symbolObject.price = price;
              symbolObject.update = updatedDttm;
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
              }
              else {
                list[object.source].push(object.symbol);
              }
              return list
            }, {})
          )
        );

        if (listId['coingecko'] && Array.isArray(listId['coingecko'])) {
          const list = new Array(...listId.coingecko).join(',');
          const priceArray = new Price$1().getMarketsPrice(
            list
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

        
        if (listId['web3space'] && Array.isArray(listId['web3space'])) {
          const chunkSize = 10;
          for (let i = 0; i < listId.web3space.length; i += chunkSize) {
          const coins = listId.web3space.slice(i, i + chunkSize).join(',');
            const coinsObject = new Dimension().getDimension(coins).reduce((object, value) => {
              if (!object[value.token_id]) {
                object[value.token_id] = value;
              }
              object[value.token_id].symbol_key=new Hash(value?.token_symbol).md5;
              return object
            }, {});
            const priceArray = new Price().getTokenSearch(coins);
            const priceObject = priceArray.reduce((object, value) => {
              if (!object[value.token_id]) {
                object[value.token_id] = value;
              }
              return object
            }, {});
            priceArray.forEach((coin)=>{
              updatePricesRow(
                this.workSheet.object[coinsObject[coin.token_id]?.symbol_key],
                priceObject[coin.token_id]?.price,
                void 0,
                new Date(priceObject[coin.token_id]?.updated_dttm)
              );
            });
          }

        }

        if (listId['cryptorank'] && Array.isArray(listId['cryptorank'])) {
          const list = new Array(...listId.cryptorank).join(',');
          const priceArray = new Price$4().getLastPrice(
            list
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

        
        if (listId['coinmarketcap'] && Array.isArray(listId['coinmarketcap'])) {
          const list = new Array(...listId.coinmarketcap).join(',');

          const priceArray = Object.values(new Price$2().getLastPrice(
            list
          ));
          if (priceArray.length) {
            priceArray.forEach((coin) => {
              const symbolKey = new Hash(coin?.symbol).md5;
              updatePricesRow(
                this.workSheet.object[symbolKey],
                coin?.quote?.USD?.price,
                void 0,
                new Date(coin?.quote?.USD?.last_updated)
              );
            });
          }
        }

        if (listId['cryptocompare'] && Array.isArray(listId['cryptocompare'])) {
          const list = new Array(...listId.cryptocompare).join(',');

          const priceArray = new Price$3().getMultiPrice(
            list
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
        rowObject.registryRowId + rowObject.account
      ).md5;
      rowObject.registryRowKey = newRegistryRowKey;
      return rowObject
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  updateRowKey() {
    const directionInKey = new Hash('in').md5;
    const directionOutKey = new Hash('out').md5;
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      let newRowKey;
      if (directionInKey === new Hash(rowObject.direction).md5) {
        newRowKey = new Hash(rowObject.registryRowKey + '#2').md5;
      } else if (directionOutKey === new Hash(rowObject.direction).md5) {
        if (rowObject.isFee) {
          newRowKey = new Hash(rowObject.registryRowKey + '#3').md5;
        } else {
          newRowKey = new Hash(rowObject.registryRowKey + '#1').md5;
        }
      }
      rowObject.rowKey = newRowKey;
      return rowObject
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  updateIsOverflow() {
    // const symbols = new Symbols().workSheet.object
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      // const overflowArray = rowObject.overflow.split('/')
      // const tokenA = overflowArray[0]
      // const tokenB = overflowArray[1]
      // const tokenAKey = new Hash(tokenA).md5
      // const tokenACategory = symbols[tokenAKey]?.symbolCategory || ''
      // const tokenBKey = new Hash(tokenB).md5
      // const tokenBCategory = symbols[tokenBKey]?.symbolCategory || ''
      if (
        [
          '0bd9f6dd716003f3818d15d2e211ee73' /*overflow*/
          , '63275978133392f666f8fcc20f502304' /*backflow*/
        ].indexOf(
          new Hash(rowObject.operation).md5
        ) !== -1
        // [
        //   '04a714bd5aaab82a18da3bd93d7dcc4f' /*LP Token*/,
        //   'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
        //   '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
        // ].indexOf(new Hash(tokenACategory).md5) === -1 &&
        // [
        //   '04a714bd5aaab82a18da3bd93d7dcc4f' /*LP Token*/,
        //   'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
        //   '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
        // ].indexOf(new Hash(tokenBCategory).md5) === -1 &&
        // tokenA !== tokenB

      ) {
        rowObject.isOverflow = true;
      } else {
        rowObject.isOverflow = false;
      }

      return rowObject
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  updatePair() {
    const directionInKey = new Hash('in').md5;
    const directionOutKey = new Hash('out').md5;
    const newObject = this.workSheet.arrayOfObject.reduce(
      (newObject, rowObject) => {
        if (!newObject[rowObject.registryRowKey]) {
          newObject[rowObject.registryRowKey] = {};
        }
        if (directionInKey === new Hash(rowObject.direction).md5) {
          newObject[rowObject.registryRowKey]['in'] = rowObject;
        } else if (directionOutKey === new Hash(rowObject.direction).md5) {
          if (rowObject.isFee) {
            newObject[rowObject.registryRowKey]['fee'] = rowObject;
          } else {
            newObject[rowObject.registryRowKey]['out'] = rowObject;
          }
        }
        return newObject
      },
      {}
    );
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      let newOverflow,
        newPriceCoef,
        newOverflowRev,
        newPriceCoefRev,
        outSymbol,
        inSymbol,
        feeSymbol,
        outPrice,
        inPrice,
        inOperationKey;

      const registryObject = newObject[rowObject.registryRowKey];
      outSymbol = registryObject['out']?.symbol;
      inSymbol = registryObject['in']?.symbol;
      feeSymbol = registryObject['fee']?.symbol;
      outPrice = registryObject['out']?.price;
      inPrice = registryObject['in']?.price;
      registryObject['fee']?.price;
      registryObject['out']?.quantity;
      registryObject['in']?.quantity;
      registryObject['fee']?.quantity;
      new Hash(registryObject['out']?.operation).md5;
      inOperationKey = new Hash(registryObject['in']?.operation).md5;
      new Hash(registryObject['fee']?.operation).md5;

      if (directionInKey === new Hash(rowObject.direction).md5) {
        if (
          [
            /*buy*/ '0461ebd2b773878eac9f78a891912d65',
            /*sell*/ '8325324b47e1e62a1c2998a640cbdc72',
          ].indexOf(inOperationKey) !== -1
        ) {
          newOverflow = inSymbol + '/' + outSymbol;
          newOverflowRev = outSymbol + '/' + inSymbol;
          newPriceCoef = inPrice / outPrice;
          newPriceCoefRev = outPrice / inPrice;
        } else {
          newOverflow = newOverflowRev = inSymbol + '/' + inSymbol;
          // newOverflowRev = newOverflow
          newPriceCoef = newPriceCoefRev = inPrice / inPrice;
          // newPriceCoefRev = newPriceCoef
        }
      } else if (directionOutKey === new Hash(rowObject.direction).md5) {
        if (rowObject.isFee) {
          newOverflow = newOverflowRev = feeSymbol + '/' + feeSymbol;
          // newOverflowRev = newOverflow
          newPriceCoef = newPriceCoefRev = 1;
          // newPriceCoefRev = 1
        } else {
          if (
            [
              /*buy*/ '0461ebd2b773878eac9f78a891912d65',
              /*sell*/ '8325324b47e1e62a1c2998a640cbdc72',
            ].indexOf(inOperationKey) !== -1
          ) {
            newOverflow = outSymbol + '/' + inSymbol;
            newOverflowRev = inSymbol + '/' + outSymbol;
            newPriceCoef = outPrice / inPrice;
            newPriceCoefRev = inPrice / outPrice;
          } else {
            newOverflow = newOverflowRev = outSymbol + '/' + outSymbol;
            // newOverflowRev = outSymbol + '/' + outSymbol
            newPriceCoef = newPriceCoefRev = outPrice / outPrice;
            // newPriceCoefRev = outPrice / outPrice
          }
        }
      }
      rowObject.overflow = newOverflow;
      rowObject.priceCoef = newPriceCoef;
      rowObject.overflowRev = newOverflowRev;
      rowObject.priceCoefRev = newPriceCoefRev;

      return rowObject
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  /**
   *
   * @param {number} startIndex
   * @param {number} endIndex
   */
  updatePriceCostBTC(startIndex, endIndex) {
    const directionInKey = new Hash('in').md5;
    const directionOutKey = new Hash('out').md5;
    const newObject = this.workSheet.arrayOfObject.reduce(
      (newObject, rowObject) => {
        if (!newObject[rowObject.registryRowKey]) {
          newObject[rowObject.registryRowKey] = {};
        }
        if (directionInKey === new Hash(rowObject.direction).md5) {
          newObject[rowObject.registryRowKey]['in'] = rowObject;
        } else if (directionOutKey === new Hash(rowObject.direction).md5) {
          if (rowObject.isFee) {
            newObject[rowObject.registryRowKey]['fee'] = rowObject;
          } else {
            newObject[rowObject.registryRowKey]['out'] = rowObject;
          }
        }
        return newObject
      },
      {}
    );
    const newArrayOfObject = this.workSheet.arrayOfObject.map(
      (rowObject, indexRow) => {
        if (indexRow >= startIndex && indexRow <= endIndex) {
          let outPrice,
            inPrice,
            feePrice,
            priceUSDBTC,
            priceUSDBTCObject,
            priceBTC,
            costBTC,
            outQuantity,
            inQuantity,
            feeQuantity;

          const registryObject = newObject[rowObject.registryRowKey];
          registryObject['out']?.symbol;
          registryObject['in']?.symbol;
          registryObject['fee']?.symbol;
          outPrice = registryObject['out']?.price;
          inPrice = registryObject['in']?.price;
          feePrice = registryObject['fee']?.price;
          outQuantity = registryObject['out']?.quantity;
          inQuantity = registryObject['in']?.quantity;
          feeQuantity = registryObject['fee']?.quantity;
          new Date(registryObject['in']?.dateTime);
          // priceUSDBTCObject = new Price().getHistoricalPrice(
          //   'b460f578-b1ce-950c-287e-dc61d0728e51', /*BTC*/
          //   dateTime,
          //   dateTime
          // ).reduce((object, value) => {
          //   if (!object[value.token_id]) {
          //     object[value.token_id] = value;
          //   }
          //   return object
          // }, {});
          priceUSDBTCObject = {
            'b460f578-b1ce-950c-287e-dc61d0728e51': {
              price_close: new Symbols().workSheet.object[new Hash('btc').md5]?.price
            }
          };
          priceUSDBTC = priceUSDBTCObject['b460f578-b1ce-950c-287e-dc61d0728e51']?.price_close;

          if (directionInKey === new Hash(rowObject.direction).md5) {
            priceBTC = inPrice / priceUSDBTC;
            costBTC = inPrice / priceUSDBTC * inQuantity;
          } else if (directionOutKey === new Hash(rowObject.direction).md5) {
            if (rowObject.isFee) {
              priceBTC = feePrice / priceUSDBTC;
              costBTC = feePrice / priceUSDBTC * feeQuantity;
            } else {
              priceBTC = outPrice / priceUSDBTC;
              costBTC = outPrice / priceUSDBTC * outQuantity;
            }
          }

          rowObject.priceBTC = priceBTC;
          rowObject.costBTC = costBTC;
        }
        return rowObject
      }
    );
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  updateHistoricalAveragePriceKey() {
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const newHistoricalAveragePriceKey = new Hash(
        rowObject.account +
        rowObject.portfolio +
        rowObject.symbol
      ).md5;
      rowObject.historicalAveragePriceKey = newHistoricalAveragePriceKey;
      return rowObject
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  // recalculateTransactions(startRow, endRow) {
  //   const symbols = new Portfolio().getWorkSheet('Symbols').object
  //   const accounts = new Portfolio().getWorkSheet('Accounts').object
  //   const newArrayOfObject = this.workSheet.arrayOfObject.map(
  //     (rowObject, indexRow) => {
  //       if (indexRow > startRow && indexRow <= endRow) {
  //         if (
  //           [
  //             '84a0f3455dcca894ace136be62efa292',
  //             '7b33b9f52598cd60f7aa6ca0082515c4',
  //             'b4479040173a9f41eeb4e98339f2a21d' /*transfer,write-off, refill*/,
  //           ].indexOf(new Hash(rowObject.operation).md5) !== -1
  //         ) {
  //           const price = this.getHistoricalPriceBuy(
  //             rowObject.dateTime,
  //             accounts[new Hash(rowObject.account).md5]?.mainAccount,
  //             rowObject.symbol,
  //             new Hash(symbols[new Hash(rowObject.symbol).md5]?.symbolCategory)
  //               .md5,
  //             symbols,
  //             true
  //           ).historicalPrice
  //           rowObject.price = price
  //           rowObject.cost = rowObject.quantity * price
  //           rowObject.updateDate = new Date()
  //         }
  //       }
  //       return rowObject
  //     }
  //   )
  //   this.workSheet.truncateInsertRows(newArrayOfObject)
  // }

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
   * @param {*} operationKey ключ операции
   * @param {*} account счет
   * @param {*} portfolio портфолио
   * @param {*} contractor контрагент
   * @param {*} symbol символ
   * @param {*} symbolCategoryKey ключ категории токена
   * @param {object} symbolsObject справочник символов
   * @param {array} transactionsArrayOfObject массив транзакций транзакций [{}]
   * @param {*} isRange признак диапазона
   * @param {*} convert параметр конвертации
   * @param {*} isOverflow признак перелива
   * @param {*} isCurrency признак валюты
   * @returns объект цена и признак исторической цены
   */
  getHistoricalPrice(
    dateTime,
    operationKey,
    account,
    portfolio,
    symbol,
    symbolCategoryKey,
    symbolsObject,
    transactionsArrayOfObject,
    isRange = false,
    convert = 'usd'
  ) {
    try {
      let historicalPrice = 0;
      let isHistoricalAveragePrice = false;
      let historicalSource = 'na';
      let historicalCurrencyPrice = 0;
      let isHistoricalCurrencyAveragePrice = false;
      let historicalCurrencySource = 'na';
      const coin = symbolsObject[new Hash(symbol).md5];
      const sourceKey = new Hash(coin?.source).md5;
      const symbolId = coin?.sourceId;

      //* Для стабильных токенов
      if (
        'e5e3fd01394b9a81296b75d5a7f4c1a2' === symbolCategoryKey /*stablecoin*/
      ) {

        historicalPrice = 1;
        isHistoricalAveragePrice = false;
        historicalSource = 'stablecoin';
      }
      //* Для фиата
      else if (
        '7d5f30a0d1641c0b6980aaf2556b32ce' === symbolCategoryKey /*fiat*/
      ) {
        if (
          sourceKey === '1dab445b170a7f0acfccea645a8879e0' /*cryptocompare*/
        ) {
          historicalPrice = new Price$3().getHistoryPrice(
            symbolId,
            dateTime,
            convert
          );
          isHistoricalAveragePrice = false;
          historicalSource = 'fiatCryptocompare';
        }
        else if (
          sourceKey === '9fcc5acecc1e69fad95aa3fec1b715c6' /*web3space*/
        ) {
          const formatDatetime = new FormatDate(dateTime).getFormatDate('yyyy-MM-dd');
          const priceObject = new Price().getHistoricalPrice(symbolId, formatDatetime, formatDatetime).reduce((object, value) => {
            if (!object[value.token_id]) {
              object[value.token_id] = value;
            }
            return object
          }, {});
          historicalPrice = priceObject[symbolId]?.price_close;
          isHistoricalAveragePrice = false;
          historicalSource = 'fiatWeb3space';
        }
      }
      //* Для токенов
      else {
        //* Расчет средневзвешенной стоимости покупки токена на основании истории покупок для диапазона данных
        const startProcess = new FormatDate();
        if (isRange) {

          const getHistoricalPriceRest = function () {
            const historicalAveragePriceKey = new Hash(account + portfolio + symbol).md5;
            //* цена исторических транзакций

            const historicalPriceAgg = transactionsArrayOfObject
              .filter((row) => {
                return (
                  new Date(row.dateTime).valueOf() < new Date(dateTime).valueOf() &&
                  ['84a0f3455dcca894ace136be62efa292' /*transfer*/].indexOf(new Hash(row.operation).md5) === -1 &&
                  historicalAveragePriceKey === row.historicalAveragePriceKey &&
                  row.isAvgPrice &&
                  !row.isDelete &&
                  !row.isFee
                )
              })
              .sort((a, b) => {
                return (
                  new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
                )
              })
              .reduce(
                (agg, tx) => {

                  agg.quantityRest += tx.quantity;

                  //* Накопление остатков
                  if (
                    agg.operationCount === 0
                  ) {
                    agg.costRest = tx.cost;
                    agg.costRestPrev = agg.costRest;
                    agg.priceRest = tx.cost / tx.quantity;
                    agg.priceRestPrev = agg.priceRest;
                  } else {
                    if (
                      agg.quantityRest > 0
                    ) {
                      if (tx.quantity < 0) {
                        agg.costRest = tx.quantity * agg.priceRestPrev + agg.costRestPrev;
                      } else {
                        agg.costRest = tx.cost + agg.costRestPrev;
                      }
                      agg.priceRest = agg.costRest / agg.quantityRest || 0;
                      agg.priceRestPrev =
                        agg.priceRest || 0;
                      agg.costRestPrev =
                        agg.costRest;
                    } else {
                      agg.quantityRest = 0;
                      agg.costRest = 0;
                      agg.costRestPrev = 0;
                      agg.priceRest = 0;
                      agg.priceRestPrev = 0;
                    }
                  }

                  agg.operationCount += 1;

                  //* расчет точности
                  const precisionArray = tx.quantity.toString().split('.');
                  const precision = precisionArray[1]
                    ? [...precisionArray[1].split('')].length
                    : 0;
                  if (precision > agg.precision && precision <= 6) {
                    agg.precision = precision;
                  }
                  return agg
                },
                {
                  precision: 0,
                  quantityRest: 0,
                  costRest: 0,
                  priceRest: 0,
                  quantityRestPrev: 0,
                  costRestPrev: 0,
                  priceRestPrev: 0,
                  operationCount: 0,
                }
              );

            //* точность стоимости
            let costPrecisionCoeff = '1';
            for (let i = 0; i < 2; i++) {
              costPrecisionCoeff += '0';
            }
            costPrecisionCoeff = costPrecisionCoeff * 1;

            //* точность исторических данных
            let historicalPricePrecisionCoeff = '1';
            for (let i = 0; i < historicalPriceAgg.precision; i++) {
              historicalPricePrecisionCoeff += '0';
            }
            historicalPricePrecisionCoeff = historicalPricePrecisionCoeff * 1;

            // console.log(
            //   'historicalPriceAgg:'
            //   , 'symbol:', symbol
            //   , 'priceRest:', historicalPriceAgg.priceRest
            //   , 'quantityRest:', historicalPriceAgg.quantityRest
            //   , 'costRest:', historicalPriceAgg.costRest
            // )

            if (historicalPriceAgg.costRest > 1 && historicalPriceAgg.quantityRest > 0) {
              return historicalPriceAgg.priceRest
            } else {
              return 0
            }
          };

          const getExternalPriceRest = function () {
            const formatDatetime = new FormatDate(dateTime).getFormatDate('yyyy-MM-dd');
            const historicalPriceObject = new Price().getHistoricalPrice(symbolId, formatDatetime, formatDatetime).reduce((object, value) => {
              if (!object[value.token_id]) {
                object[value.token_id] = value;
              }
              return object
            }, {});

            // console.log(
            //   ' getExternalPriceRest:'
            //   , 'symbol:', symbol
            //   , 'symbolId:', symbolId
            //   , 'formatDatetime:', formatDatetime
            //   , 'historicalPriceObject:', historicalPriceObject
            // )

            return historicalPriceObject[symbolId]?.price_close || 0
          };

          //* Определение цены токена

          let historicalPriceRest = 0;
          let externalPricePriceRest = 0;

          if (
            [
              '84a0f3455dcca894ace136be62efa292' /*transfer*/
              , '0bd9f6dd716003f3818d15d2e211ee73' /*overflow*/
              , '63275978133392f666f8fcc20f502304' /*backflow*/
            ].indexOf(
              operationKey
            ) !== -1
          ) {
            historicalPriceRest = getHistoricalPriceRest();
            if (historicalPriceRest > 0) {
              historicalPrice = historicalPriceRest;
              isHistoricalAveragePrice = true;
              historicalSource = 'historyTransactions';
            }
            else {
              historicalPrice = 0;
              isHistoricalAveragePrice = false;
              historicalSource = 'na';
            }
          }
          else if (
            [
              '0461ebd2b773878eac9f78a891912d65' /*buy*/
              , '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
              , 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
              , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
            ].indexOf(
              operationKey
            ) !== -1
          ) {
            externalPricePriceRest = getExternalPriceRest();
            if (externalPricePriceRest > 0) {
              historicalPrice = externalPricePriceRest;
              isHistoricalAveragePrice = false;
              historicalSource = 'externalWeb3space';
            }
            else {
              if (coin.price > 0) {
                historicalPrice = coin.price;
                isHistoricalAveragePrice = false;
                historicalSource = 'externalCurrent';
              } else {
                historicalPrice = 0;
                isHistoricalAveragePrice = false;
                historicalSource = 'na';
              }
            }
          }

          // new Portfolio().log.addMessage(
          //   'getHistoricalPrice:'
          //   , 'ID:' + startProcess.value
          //   , 'Time spent: ' + startProcess.getTimeDiff() + '\n'
          //   + 'symbol:' + symbol + '\n'
          //   + 'isOverflow:' + isOverflow + '\n'
          //   + 'isCurrency:' + isCurrency + '\n'
          //   + 'operationKey:' + operationKey + '\n'
          //   + 'historicalPriceRest:' + historicalPriceRest + '\n'
          //   + 'externalPricePriceRest:' + externalPricePriceRest + '\n'
          //   + 'historicalPrice:', historicalPrice + '\n'
          //   + 'isHistoricalAveragePrice:' + isHistoricalAveragePrice + '\n'
          //   + 'historicalSource:' + historicalSource + '\n'
          //   + 'historicalCurrencyPrice:' + historicalCurrencyPrice + '\n'
          //   + 'isHistoricalCurrencyAveragePrice:' + isHistoricalCurrencyAveragePrice + '\n'
          //   + 'historicalCurrencySource:' + historicalCurrencySource + '\n'
          // )

          // console.log(
          //   'getHistoricalPrice:', '\n'
          //   , 'symbol:', symbol, '\n'
          //   , 'isOverflow:', isOverflow, '\n'
          //   , 'isCurrency:', isCurrency, '\n'
          //   , 'operationKey:', operationKey, '\n'
          //   , 'historicalPriceRest:', historicalPriceRest, '\n'
          //   , 'externalPricePriceRest:', externalPricePriceRest, '\n'
          //   , 'historicalPrice:', historicalPrice, '\n'
          //   , 'isHistoricalAveragePrice:', isHistoricalAveragePrice, '\n'
          //   , 'historicalSource:', historicalSource, '\n'
          //   , 'historicalCurrencyPrice:', historicalCurrencyPrice, '\n'
          //   , 'isHistoricalCurrencyAveragePrice:', isHistoricalCurrencyAveragePrice, '\n'
          //   , 'historicalCurrencySource:', historicalCurrencySource, '\n'
          // )

        }
      }
      return { historicalPrice, isHistoricalAveragePrice, historicalSource, historicalCurrencyPrice, isHistoricalCurrencyAveragePrice, historicalCurrencySource }
    } catch (error) {
      console.error('Transactions.getHistoricalPriceBuy', error.stack);
    }
  }
}

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName());
  }

  /**
   * Получение портфолио
   * @param {string} portfolio портфолио отправителя
   * @param {string} symbolCategoryKey ключ категории символа
   * @returns счет
   */
  getPortfolio(portfolio, symbolCategoryKey) {
    try {
      // if (
      //   /*stablecoin*/ 'e5e3fd01394b9a81296b75d5a7f4c1a2' === symbolCategoryKey
      // ) {
      //   return 'Stablecoin'
      // } else if (
      //   /* fiat */ '7d5f30a0d1641c0b6980aaf2556b32ce' === symbolCategoryKey
      // ) {
      //   return 'Fiat'
      // }
      return portfolio
    } catch (error) {
      console.error('Registry.getPortfolio', error.stack);
    }
  }

  /**
   * Определение счета
   * @param {*} accountSender счет отправитель
   * @param {*} accountRecipient счет получатель
   * @returns
   */
  getAccount(accountSender, accountRecipient) {
    try {
      if (accountRecipient) {
        return new Hash(accountRecipient)
      }
      return new Hash(accountSender)
    } catch (error) {
      console.error('Registry.getAccount', error.stack);
    }
  }

  /**
   * получение улюча категории символа
   * @param {*} symbol символ
   * @param {*} symbols справочник символов
   * @returns ключ категории символа
   */
  getSymbolCategoryKey(symbolKey, symbols) {
    try {
      return new Hash(symbols[symbolKey]?.symbolCategory).md5
    } catch (error) {
      console.error('Registry.getSymbolCategoryKey', error.stack);
    }
  }

  /**
   * Получение признака средней цены для расчета истории
   * @param {*} directionKey
   * @param {*} operationKey
   * @param {*} categoryKey
   * @returns признак средней цены
   */
  getIsAvgPrice(directionKey, operationKey, categoryKey) {
    const inKey = new Hash('in').md5;
    const outKey = new Hash('out').md5;
    if (/*stablecoin*/ 'e5e3fd01394b9a81296b75d5a7f4c1a2' !== categoryKey) {
      if (
        /*write-off*/ '7b33b9f52598cd60f7aa6ca0082515c4' === operationKey &&
        directionKey === outKey
      ) {
        return true
      } else if (
        [
          '84a0f3455dcca894ace136be62efa292' /*transfer*/
          , 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
          , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
        ].indexOf(operationKey) !== -1 &&
        directionKey === inKey
      ) {
        return true
      } else if (
        [
          /*buy*/ '0461ebd2b773878eac9f78a891912d65',
          /*sell*/ '8325324b47e1e62a1c2998a640cbdc72',
        ].indexOf(operationKey) !== -1
      ) {
        return true
      }
    }
    return false
  }

  updateTransactions(isRange = false) {
    const startProcess = new FormatDate();
    try {
      const symbols = new Symbols().workSheet.object;
      const transactions = new Transactions();
      const historicalPrice = new HistoricalPrice();
      const transactionsArrayOfObject = [];
      const updateDate = new Date();
      const account = this.workSheet.sheetName;
      const directionOut = new Hash('out');
      const directionIn = new Hash('in');
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
          portfolioSender,
          accountSender,
          accountSenderKey,
          accountRecipient,
          accountRecipientKey,
          portfolioRecipient,
          sender,
          recipient,
          feeSender,
          feePrice,
          feePortfolio,
          mainSymbol,
          feeCurrency,
          feeCurrencySymbolCategoryKey,
          feeQty,
          isDelete,
          isLiquidityPool,
          isFee,
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
          registryTimestamp,
          symbolPriceCoef,
          currencyPriceCoef,
          priceUSDBTC,
          isOverflow,
          isBetweenSymbol,
          coinSymbolKey,
          currencySymbolKey,
          currencyPriceManual,
          coinPriceManual;

        const transactionRow = [];
        const hhmm = new FormatNumber(
          rowValues.time
        ).getHourAndMinuteFromNumber();
        const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
          .date;
        registryRowKey = rowValues.rowKey;
        const accountSenderTemp = this.getAccount(account, void 0);
        accountSender = accountSenderTemp.stringLowerCase;
        accountSenderKey = accountSenderTemp.md5;
        const accountRecipientTemp = this.getAccount(
          account,
          rowValues.accountRecipient
        );
        accountRecipient = accountRecipientTemp.stringLowerCase;
        accountRecipientKey = accountRecipientTemp.md5;
        registryRowKeyTimestamp = rowValues.rowKeyTimestamp;
        registryTimestamp = rowValues.timestamp;
        operationKey = new Hash(rowValues.operation).md5;
        lockStatusKey = new Hash(rowValues.lockStatus).md5;
        coinQty =
          typeof rowValues.coinQty === 'number' ? rowValues.coinQty : void 0;
        coinPriceManual = typeof rowValues.coinPrice === 'number' ? rowValues.coinPrice : void 0;
        currencyQty =
          typeof rowValues.currencyQty === 'number'
            ? rowValues.currencyQty
            : void 0;
        currencyPerCoin =
          typeof rowValues.currencyPerCoin === 'number'
            ? rowValues.currencyPerCoin
            : void 0;
        currencyPriceManual = typeof rowValues.currencyPrice === 'number'
          ? rowValues.currencyPrice
          : void 0;
        coinSymbol = rowValues.coin;
        coinSymbolKey = new Hash(coinSymbol).md5;
        coinSymbolCategoryKey = this.getSymbolCategoryKey(
          coinSymbolKey,
          symbols
        );
        currencySymbol = rowValues.currency || rowValues.coin;
        currencySymbolKey = new Hash(currencySymbol).md5;
        currencySymbolCategoryKey = this.getSymbolCategoryKey(
          currencySymbolKey,
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
        isHistoricalAveragePriceSymbol = false;
        isHistoricalAveragePriceFeeCurrency = false;
        isHistoricalAveragePriceCurrency = false;
        isOverflow = false;
        isBetweenSymbol = false;

        //* определение перелива
        if (
          [
            '04a714bd5aaab82a18da3bd93d7dcc4f' /*LP Token*/,
            'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
            '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
          ].indexOf(coinSymbolCategoryKey) === -1 &&
          [
            '04a714bd5aaab82a18da3bd93d7dcc4f' /*LP Token*/,
            'e5e3fd01394b9a81296b75d5a7f4c1a2' /*Stablecoin*/,
            '7d5f30a0d1641c0b6980aaf2556b32ce' /*Fiat*/,
          ].indexOf(currencySymbolCategoryKey) === -1 &&
          coinSymbolKey !== currencySymbolKey
        ) {
          isBetweenSymbol = true;
        }
        if (
          [
            '0bd9f6dd716003f3818d15d2e211ee73' /*overflow*/
            , '63275978133392f666f8fcc20f502304' /*backflow*/
          ].indexOf(
            operationKey
          ) !== -1
        ) {
          isOverflow = true;
        }

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
            '84a0f3455dcca894ace136be62efa292' /*transfer*/,
            '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/,
            'b4479040173a9f41eeb4e98339f2a21d' /*refill*/,
          ].indexOf(operationKey) !== -1
        ) {
          currencyPerCoin = 1;
          if (
            [
              /*transfer, write-off*/
              '84a0f3455dcca894ace136be62efa292',
              '7b33b9f52598cd60f7aa6ca0082515c4',
            ].indexOf(operationKey) !== -1
          ) {
            portfolioSender = this.getPortfolio(
              rowValues.portfolioSender,
              coinSymbolCategoryKey
            );
            rowKey1 = new Hash(rowValues.rowKey + '#1').md5;

            transactionRow.push({
              rowKey: rowKey1,
              account: accountSender,
              operation: rowValues.operation.toLowerCase(),
              accountKey: accountSenderKey,
              direction: directionOut.stringLowerCase,
              portfolio: portfolioSender,
              contractor: sender,
              mainSymbol: void 0,
              symbol: coinSymbol,
              overflow: coinSymbol + '/' + currencySymbol,
              overflowRev: currencySymbol + '/' + coinSymbol,
              quantity: coinQty * -1,
              isFee,
              isLock: isSenderLock,
              isLiquidityPool,
              isAvgPrice: this.getIsAvgPrice(
                directionOut.md5,
                new Hash(rowValues.operation).md5,
                coinSymbolCategoryKey
              ),
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
              isOverflow: false,
            });
          }
          if (
            [
              /*transfer, refill*/
              '84a0f3455dcca894ace136be62efa292',
              'b4479040173a9f41eeb4e98339f2a21d',
            ].indexOf(operationKey) !== -1
          ) {
            portfolioRecipient = this.getPortfolio(
              rowValues.portfolioRecipient || rowValues.portfolioSender,
              coinSymbolCategoryKey
            );
            portfolioSender = this.getPortfolio(
              rowValues.portfolioSender,
              coinSymbolCategoryKey
            );
            rowKey2 = new Hash(rowValues.rowKey + '#2').md5;
            transactionRow.push({
              rowKey: rowKey2,
              direction: 'in',
              account: accountRecipient,
              accountKey: accountRecipientKey,
              operation: rowValues.operation.toLowerCase(),
              portfolio: portfolioRecipient,
              contractor: recipient,
              mainSymbol: void 0,
              symbol: coinSymbol,
              overflow: coinSymbol + '/' + currencySymbol,
              overflowRev: currencySymbol + '/' + coinSymbol,
              quantity: coinQty,
              isFee,
              isLock: isRecipientLock,
              isLiquidityPool,
              isAvgPrice: this.getIsAvgPrice(
                directionIn.md5,
                new Hash(rowValues.operation).md5,
                coinSymbolCategoryKey
              ),
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
              isOverflow: false,
            });
          }
        } else if (
          [
            '0461ebd2b773878eac9f78a891912d65' /*buy*/
          ].indexOf(operationKey) !==
          -1
        ) {
          portfolioSender = this.getPortfolio(
            rowValues.portfolioSender,
            currencySymbolCategoryKey
          );
          portfolioRecipient = this.getPortfolio(
            rowValues.portfolioRecipient || rowValues.portfolioSender,
            coinSymbolCategoryKey
          );
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5;
          transactionRow.push({
            rowKey: rowKey1,
            direction: directionOut.stringLowerCase,
            account: accountSender,
            accountKey: accountSenderKey,
            portfolio: portfolioSender,
            operation: isBetweenSymbol ? 'sell' : rowValues.operation.toLowerCase(),
            contractor: sender,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            overflow: currencySymbol + '/' + coinSymbol,
            overflowRev: coinSymbol + '/' + currencySymbol,
            quantity: currencyQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionOut.md5,
              isBetweenSymbol ? new Hash('sell').md5 : new Hash(rowValues.operation).md5,
              currencySymbolCategoryKey
            ),
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
            isOverflow: false,
          });
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5;
          transactionRow.push({
            rowKey: rowKey2,
            direction: directionIn.stringLowerCase,
            isLock: rowValues.isLock,
            account: accountRecipient,
            accountKey: accountRecipientKey,
            operation: isBetweenSymbol ? 'buy' : rowValues.operation.toLowerCase(),
            portfolio: portfolioRecipient,
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            overflow: coinSymbol + '/' + currencySymbol,
            overflowRev: currencySymbol + '/' + coinSymbol,
            quantity: coinQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionIn.md5,
              isBetweenSymbol ? new Hash('buy').md5 : new Hash(rowValues.operation).md5,
              coinSymbolCategoryKey
            ),
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
            isOverflow: false,
          });
        } else if (
          ['8325324b47e1e62a1c2998a640cbdc72' /*sell*/].indexOf(
            operationKey
          ) !== -1
        ) {
          portfolioSender = this.getPortfolio(
            rowValues.portfolioSender,
            coinSymbolCategoryKey
          );
          portfolioRecipient = this.getPortfolio(
            rowValues.portfolioRecipient || rowValues.portfolioSender,
            currencySymbolCategoryKey
          );
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5;
          transactionRow.push({
            rowKey: rowKey1,
            direction: directionOut.stringLowerCase,
            account: accountSender,
            accountKey: accountSenderKey,
            portfolio: portfolioSender,
            contractor: sender,
            operation: isBetweenSymbol ? 'buy' : rowValues.operation.toLowerCase(),
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            overflow: coinSymbol + '/' + currencySymbol,
            overflowRev: currencySymbol + '/' + coinSymbol,
            quantity: coinQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionOut.md5,
              isBetweenSymbol ? new Hash('buy').md5 : new Hash(rowValues.operation).md5,
              coinSymbolCategoryKey
            ),
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
            isOverflow: false,
          });
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5;
          transactionRow.push({
            rowKey: rowKey2,
            direction: directionIn.stringLowerCase,
            isLock: rowValues.isLock,
            account: accountRecipient,
            accountKey: accountRecipientKey,
            portfolio: portfolioRecipient,
            operation: isBetweenSymbol ? 'sell' : rowValues.operation.toLowerCase(),
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            overflow: currencySymbol + '/' + coinSymbol,
            overflowRev: coinSymbol + '/' + currencySymbol,
            quantity: currencyQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionIn.md5,
              isBetweenSymbol ? new Hash('sell').md5 : new Hash(rowValues.operation).md5,
              currencySymbolCategoryKey
            ),
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
            isOverflow: false,
          });
        } else if (
          ['0bd9f6dd716003f3818d15d2e211ee73' /*overflow*/].indexOf(
            operationKey
          ) !== -1
        ) {
          portfolioSender = this.getPortfolio(
            rowValues.portfolioSender,
            currencySymbolCategoryKey
          );
          portfolioRecipient = this.getPortfolio(
            rowValues.portfolioRecipient || rowValues.portfolioSender,
            coinSymbolCategoryKey
          );
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5;
          transactionRow.push({
            rowKey: rowKey1,
            direction: directionOut.stringLowerCase,
            account: accountSender,
            accountKey: accountSenderKey,
            portfolio: portfolioSender,
            operation: rowValues.operation.toLowerCase(),
            contractor: sender,
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            overflow: currencySymbol + '/' + coinSymbol,
            overflowRev: coinSymbol + '/' + currencySymbol,
            quantity: currencyQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionOut.md5,
              new Hash(rowValues.operation).md5,
              currencySymbolCategoryKey
            ),
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
            isOverflow: true,
          });
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5;
          transactionRow.push({
            rowKey: rowKey2,
            direction: directionIn.stringLowerCase,
            isLock: rowValues.isLock,
            account: accountRecipient,
            accountKey: accountRecipientKey,
            portfolio: portfolioRecipient,
            operation: rowValues.operation.toLowerCase(),
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            overflow: coinSymbol + '/' + currencySymbol,
            overflowRev: currencySymbol + '/' + coinSymbol,
            quantity: coinQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionIn.md5,
              new Hash(rowValues.operation).md5,
              coinSymbolCategoryKey
            ),
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
            isOverflow: true,
          });
        } else if (
          ['63275978133392f666f8fcc20f502304' /*backflow*/].indexOf(
            operationKey
          ) !== -1
        ) {
          portfolioSender = this.getPortfolio(
            rowValues.portfolioSender,
            coinSymbolCategoryKey
          );
          portfolioRecipient = this.getPortfolio(
            rowValues.portfolioRecipient || rowValues.portfolioSender,
            currencySymbolCategoryKey
          );
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5;
          transactionRow.push({
            rowKey: rowKey1,
            direction: directionOut.stringLowerCase,
            account: accountSender,
            accountKey: accountSenderKey,
            portfolio: portfolioSender,
            contractor: sender,
            operation: rowValues.operation.toLowerCase(),
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            overflow: currencySymbol + '/' + coinSymbol,
            overflowRev: coinSymbol + '/' + currencySymbol,

            quantity: currencyQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionOut.md5,
              new Hash(rowValues.operation).md5,
              coinSymbolCategoryKey
            ),
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
            isOverflow: false,
          });
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5;
          transactionRow.push({
            rowKey: rowKey2,
            direction: directionIn.stringLowerCase,
            isLock: rowValues.isLock,
            account: accountRecipient,
            accountKey: accountRecipientKey,
            portfolio: portfolioRecipient,
            operation: rowValues.operation.toLowerCase(),
            contractor: recipient,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            overflow: coinSymbol + '/' + currencySymbol,
            overflowRev: currencySymbol + '/' + coinSymbol,

            quantity: coinQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: this.getIsAvgPrice(
              directionIn.md5,
              new Hash(rowValues.operation).md5,
              currencySymbolCategoryKey
            ),
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
            isOverflow: false,
          });
        }

        //* Расчет текущей или исторической цены покупаемого токена
        let historicalPriceBuyCurrency;

        historicalPriceBuyCurrency = historicalPrice.getHistoricalPrice(
          dateTime,
          operationKey,
          accountSender,
          portfolioSender,
          ['63275978133392f666f8fcc20f502304' /*backflow*/].indexOf(
            operationKey
          ) !== -1 ? coinSymbol : currencySymbol,
          ['63275978133392f666f8fcc20f502304' /*backflow*/].indexOf(
            operationKey
          ) !== -1 ? coinSymbolCategoryKey : currencySymbolCategoryKey,
          symbols,
          Object.values(transactions.workSheet.object),
          isRange,
          'usd'
        );



        //* цена валюты
        currencyPrice = currencyPriceManual ? currencyPriceManual : historicalPriceBuyCurrency?.historicalPrice;
        isHistoricalAveragePriceCurrency = currencyPriceManual ? false :
          historicalPriceBuyCurrency?.isHistoricalAveragePrice;

        if (['63275978133392f666f8fcc20f502304' /*backflow*/].indexOf(
          operationKey
        ) !== -1) {
          if (coinPriceManual) {
            symbolPrice = coinPriceManual;
          } else {
            symbolPrice = currencyPrice * currencyPerCoin;
          }

        } else {
          if (coinPriceManual) {
            symbolPrice = coinPriceManual;
          } else {
            symbolPrice = currencyPrice * currencyPerCoin;
          }
        }

        isHistoricalAveragePriceSymbol =
          isHistoricalAveragePriceCurrency;

        //* расчет коэффициентов пары
        symbolPriceCoef = symbolPrice / currencyPrice;
        currencyPriceCoef = currencyPrice / symbolPrice;

        // console.log(
        //   'currencySymbol:', currencySymbol, '\n'
        //   , 'operation:', rowValues.operation, '\n'
        //   , 'isOverflow:', isOverflow, '\n'
        //   , 'historicalPriceBuyCurrency:', historicalPriceBuyCurrency, '\n'
        //   , 'currencyPrice:', currencyPrice, '\n'
        //   , 'isHistoricalAveragePriceCurrency:', isHistoricalAveragePriceCurrency, '\n'
        // )

        // console.log(
        //   'coinSymbol:', coinSymbol, '\n'
        //   , 'operation:', rowValues.operation, '\n'
        //   , 'isOverflow:', isOverflow, '\n'
        //   , 'historicalPriceBuyCoin:', historicalPriceBuyCoin, '\n'
        //   , 'symbolPrice:', symbolPrice, '\n'
        //   , 'isHistoricalAveragePriceSymbol:', isHistoricalAveragePriceSymbol, '\n'
        // )

        const priceUSDBTCObjectExternal = new Price().getHistoricalPrice(
          'b460f578-b1ce-950c-287e-dc61d0728e51', /*BTC*/
          new FormatDate(dateTime).getFormatDate('yyyy-MM-dd'),
          new FormatDate(dateTime).getFormatDate('yyyy-MM-dd')
        ).reduce((object, value) => {
          if (!object[value.token_id]) {
            object[value.token_id] = value;
          }
          return object
        }, {});

        const priceUSDBTCObjectLast = {
          'b460f578-b1ce-950c-287e-dc61d0728e51': {
            price_close: new Symbols().workSheet.object[new Hash('btc').md5]?.price
          }
        };

        if (priceUSDBTCObjectExternal['b460f578-b1ce-950c-287e-dc61d0728e51']?.price_close > 0) {
          priceUSDBTC = priceUSDBTCObjectExternal['b460f578-b1ce-950c-287e-dc61d0728e51']?.price_close;
        }
        else {
          priceUSDBTC = priceUSDBTCObjectLast['b460f578-b1ce-950c-287e-dc61d0728e51']?.price_close;
        }

        //* Комиссия
        if (feeCurrency && feeQty > 0) {
          rowKey3 = new Hash(rowValues.rowKey + '#3').md5;
          const feeCurrencyKey = new Hash(rowValues.feeCurrency).md5;
          feeCurrencySymbolCategoryKey = this.getSymbolCategoryKey(
            feeCurrencyKey,
            symbols
          );
          feePortfolio = this.getPortfolio(
            rowValues.portfolioSender,
            feeCurrencySymbolCategoryKey
          );
          transactionRow.push({
            rowKey: rowKey3,
            direction: directionOut.stringLowerCase,
            account: accountSender,
            accountKey: accountSenderKey,
            operation: 'write-off',
            portfolio: feePortfolio,
            contractor: feeSender,
            mainSymbol: void 0,
            symbol: feeCurrency,
            overflow: feeCurrency + '/' + feeCurrency,
            overflowRev: feeCurrency + '/' + feeCurrency,
            quantity: feeQty * -1,
            isFee: true,
            isLock: false,
            isLiquidityPool: false,
            isAvgPrice: this.getIsAvgPrice(
              directionOut.md5,
              /*write-off*/ '7b33b9f52598cd60f7aa6ca0082515c4',
              feeCurrencySymbolCategoryKey
            ),
            isFeePrice: true,
            isSymbolPrice: false,
            isCurencyPrice: false,
            isOverflow: false,
          });

          //* Расчет текущей или исторической цены комиссии токена

          const historicalPriceBuyFee = historicalPrice.getHistoricalPrice(
            dateTime,
            '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/,
            accountSender,
            feePortfolio,
            feeCurrency,
            feeCurrencySymbolCategoryKey,
            symbols,
            Object.values(transactions.workSheet.object),
            isRange,
            'usd',
            false,
            false
          );

          feePrice = historicalPriceBuyFee?.historicalPrice;
          isHistoricalAveragePriceFeeCurrency =
            historicalPriceBuyFee?.isHistoricalAveragePrice;

          // console.log(
          //   'feeCurrency:', feeCurrency, '\n'
          //   , 'isOverflow:', isOverflow, '\n'
          //   , 'historicalPriceBuyFee:', historicalPriceBuyFee, '\n'
          //   , 'feePrice:', feePrice, '\n'
          //   , 'isHistoricalAveragePriceFeeCurrency:', isHistoricalAveragePriceFeeCurrency, '\n'
          // )

        }

        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          let priceUSD, priceCoef, priceBTC, costBTC, costUSD, priceCoefRev;
          if (tx.isSymbolPrice) {
            priceUSD = symbolPrice;
            priceBTC = symbolPrice / priceUSDBTC;
            isHistoricalAveragePrice = isHistoricalAveragePriceSymbol;
            if (
              [
                '0461ebd2b773878eac9f78a891912d65'  /*buy*/
                , '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
                , '0bd9f6dd716003f3818d15d2e211ee73' /*overflow*/
                , '63275978133392f666f8fcc20f502304' /*backflow*/
              ].indexOf(operationKey) !== -1
            ) {
              priceCoef = symbolPriceCoef;
              priceCoefRev = currencyPriceCoef;
            } else {
              priceCoef = 1;
              priceCoefRev = 1;
            }
          } else if (tx.isFeePrice) {
            priceUSD = feePrice;
            priceBTC = feePrice / priceUSDBTC;
            isHistoricalAveragePrice = isHistoricalAveragePriceFeeCurrency;
            priceCoef = 1;
            priceCoefRev = 1;
          } else if (tx.isCurencyPrice) {
            priceUSD = currencyPrice;
            priceBTC = currencyPrice / priceUSDBTC;
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency;
            if (
              [
                '0461ebd2b773878eac9f78a891912d65' /*buy*/
                , '8325324b47e1e62a1c2998a640cbdc72'  /*sell*/
                , '0bd9f6dd716003f3818d15d2e211ee73' /*overflow*/
                , '63275978133392f666f8fcc20f502304' /*backflow*/
              ].indexOf(operationKey) !== -1
            ) {
              priceCoef = currencyPriceCoef;
              priceCoefRev = symbolPriceCoef;
            } else {
              priceCoef = 1;
              priceCoefRev = 1;
            }
          }

          costUSD = tx.quantity * priceUSD;
          costBTC = tx.quantity * priceBTC;

          const object = {
            rowKey: tx.rowKey,
            accountKey: tx.accountKey,
            account: tx.account,
            historicalAveragePriceKey: new Hash(
              tx.account + tx.portfolio + tx.symbol
            ).md5,
            dateTime: dateTime,
            direction: tx.isFee ? 'out' : tx.direction.toLowerCase(),
            operation: tx.isFee
              ? 'write-off'
              : tx.operation.toLowerCase(),
            portfolio: tx.portfolio.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            overflow: tx.overflow ? tx.overflow.toLowerCase() : void 0,
            overflowRev: tx.overflowRev ? tx.overflowRev.toLowerCase() : void 0,
            mainSymbol: tx.mainSymbol ? tx.mainSymbol.toLowerCase() : void 0,
            symbol: tx.symbol.toLowerCase(),
            quantity: tx.quantity,
            price: priceUSD || 0,
            cost: costUSD || 0,
            priceBTC: priceBTC || 0,
            costBTC: costBTC || 0,
            priceCoef: priceCoef || 0,
            priceCoefRev: priceCoefRev || 0,
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
            isOverflow: tx.isOverflow,
          };

          //* вставка строки в транзакции
          const registryTimestampCache = this.workSheet.scriptCache.getCache(
            registryRowKeyTimestamp
          );

          if (
            registryTimestamp === registryTimestampCache ||
            !registryTimestampCache
          ) {
            new Promise((resolve) => {
              transactionsArrayOfObject.push(object);
              resolve(object);
            }).then((object) => {
              const rowObject = new FormatObject(
                transactions.workSheet.getRowObject(object)
              ).getCopy();
              transactions.workSheet.object[rowObject.rowKey] = rowObject;
            });
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

  deleteDateSaved() {
    this.workSheet.arrayOfObject.forEach((object) => {
      this.workSheet.insertRange(
        [[void 0, void 0]],
        object.rowNum,
        this.workSheet.head.dateSaved.idx + 1
      );
    });
  }

  insertDateSaved() {
    this.workSheet.arrayOfObject.forEach((object) => {
      this.workSheet.insertRange(
        [[new FormatDate().getFormatDate('YYYY-MM-dd HH:mm:ss'), void 0]],
        object.rowNum,
        this.workSheet.head.dateSaved.idx + 1
      );
    });
  }

  validateTransactions() {
    try {
      const transactions = new Transactions();
      const errorKeyArray = [];

      const sheetNameArray = new Portfolio()
        .getWorkSheet('Accounts')
        .arrayOfObject.map((m) => m.name);

      sheetNameArray.forEach((sheetName) => {
        const workSheetRegistry = new Portfolio().getWorkSheet(sheetName);
        const workSheetObject = workSheetRegistry.object;

        const workSheetKeys = Object.keys(workSheetRegistry.object);

        const accountKey = new Hash(sheetName).md5;

        const registryRowKeyArray = transactions.workSheet.arrayOfObject
          .filter((objectRow) => accountKey === objectRow.accountKey)
          .reduce((registryRowKeyArray, objectRow) => {
            if (!registryRowKeyArray.includes(objectRow.registryRowKey)) {
              registryRowKeyArray.push(objectRow.registryRowKey);
            }

            return registryRowKeyArray
          }, []);

        registryRowKeyArray.forEach((registryRowKey) => {
          if (!workSheetKeys.includes(registryRowKey)) {
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
      if (!object[tx.portfolio]) {
        object[tx.portfolio] = {};
      }
      if (!object[tx.portfolio]) {
        object[tx.portfolio] = {};
      }
      if (!object[tx.portfolio][tx.mainSymbol]) {
        object[tx.portfolio][tx.mainSymbol] = [];
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
      object[tx.portfolio][tx.mainSymbol].push({
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
    Object.entries(aggBalance).forEach(([portfolio, level0]) => {
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
          rowKey: new Hash(portfolio + mainCoin).md5,
          portfolio: portfolio.toUpperCase(),
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
      const inKey = new Hash('in').md5;
      const outKey = new Hash('out').md5;
      const updateDate = new FormatDate();
      const transactions = new Transactions().workSheet.arrayOfObject
        .filter((row) => row.isDelete === false)
        .sort((a, b) => {
          return new Date(a.dateTime).valueOf() - new Date(b.dateTime).valueOf()
        });

      //* расчет по портфолио  
      const aggFlowPortfolio = transactions
        .filter((row) => ['84a0f3455dcca894ace136be62efa292' /*transfer*/].indexOf(new Hash(row.operation).md5) === -1)
        .reduce((agg, tx) => {
          const operationKey = new Hash(tx.operation).md5;
          const directionKey = new Hash(tx.direction).md5;
          const symbolKey = new Hash(tx.symbol).md5;
          const symbolCategory = symbols[symbolKey]?.symbolCategory || '';

          if (!agg[tx.account]) {
            agg[tx.account] = {};
          }

          if (!agg[tx.account][tx.portfolio]) {
            agg[tx.account][tx.portfolio] = {};
          }

          if (!agg[tx.account][tx.portfolio][tx.symbol]) {
            agg[tx.account][tx.portfolio][tx.symbol] = {
              quantityRest: 0,
              costRest: 0,
              costRestPrev: 0,
              priceRest: 0,
              priceRestPrev: 0,
              quantityRestOverflow: 0,
              costRestOverflow: 0,
              costRestPrevOverflow: 0,
              priceRestOverflow: 0,
              priceRestPrevOverflow: 0,
              quantityRestWoOverflow: 0,
              costRestWoOverflow: 0,
              costRestPrevWoOverflow: 0,
              priceRestWoOverflow: 0,
              priceRestPrevWoOverflow: 0,
              quantityRestInvest: 0,
              costRestInvest: 0,
              costTotal: 0,
              costRestInvestPrev: 0,
              priceRestInvest: 0,
              priceRestInvestPrev: 0,
              operationCount: 0,
              pnlRealized: 0,
              costRealized: 0
            };
          }

          //* Накопление остатков
          agg[tx.account][tx.portfolio][tx.symbol].quantityRest += tx.quantity;

          //* остаток по переливу
          if (tx.isOverflow === true) {
            agg[tx.account][tx.portfolio][tx.symbol].quantityRestOverflow +=
              tx.quantity;

          }
          //* остаток без перелива
          if (tx.isOverflow === false) {
            agg[tx.account][tx.portfolio][tx.symbol].quantityRestWoOverflow +=
              tx.quantity;
          }

          //* Накопление количества инвестированношгоe
          if (
            tx.isOverflow === false
            &&
            tx.isFee === false
            &&
            (
              [
                'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
                , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
              ].indexOf(operationKey) === -1
              ||
              [
                '7d5f30a0d1641c0b6980aaf2556b32ce' /* Fiat */
              ].indexOf(
                new Hash(symbolCategory).md5
              ) !== -1
            )
          ) {
            agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest += tx.quantity;
          }

          //* Накопление остатков для портфолио
          if (
            agg[tx.account][tx.portfolio][tx.symbol]
              .operationCount === 0
          )
          //* первая операция 
          {
            if (
              tx.isOverflow === false
              &&
              tx.isFee === false
              &&
              (
                [
                  'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
                  , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
                ].indexOf(operationKey) === -1
                ||
                [
                  '7d5f30a0d1641c0b6980aaf2556b32ce' /* Fiat */
                ].indexOf(
                  new Hash(symbolCategory).md5
                ) !== -1
              )
            ) {
              agg[tx.account][tx.portfolio][tx.symbol].costRestInvest =
                tx.cost;
              agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev =
                agg[tx.account][tx.portfolio][tx.symbol].costRestInvest;
              agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest =
                tx.cost / tx.quantity;
              agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev =
                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest;
            }

            //* общий остаток
            agg[tx.account][tx.portfolio][tx.symbol].costRest =
              tx.cost;
            agg[tx.account][tx.portfolio][tx.symbol].costRestPrev =
              agg[tx.account][tx.portfolio][tx.symbol].costRest;
            agg[tx.account][tx.portfolio][tx.symbol].priceRest =
              tx.cost / tx.quantity;
            agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev =
              agg[tx.account][tx.portfolio][tx.symbol].priceRest;

            //* остаток по переливу
            if (tx.isOverflow === true) {
              agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow =
                tx.cost;
              agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow =
                agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow;
              agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow =
                tx.cost / tx.quantity;
              agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevOverflow =
                agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow;
            }

            //* остаток без перелива
            if (tx.isOverflow === false) {
              agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow =
                tx.cost;
              agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow =
                agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow;
              agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow =
                tx.cost / tx.quantity;
              agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevWoOverflow =
                agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow;
            }

          }
          //* не первая операция
          else {
            //*остаток инвестиций
            if (
              tx.isOverflow === false
              &&
              tx.isFee === false
              &&
              (
                [
                  'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
                  , '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
                ].indexOf(operationKey) === -1
                ||
                [
                  '7d5f30a0d1641c0b6980aaf2556b32ce' /* Fiat */
                ].indexOf(
                  new Hash(symbolCategory).md5
                ) !== -1
              )
            ) {
              if (
                agg[tx.account][tx.portfolio][tx.symbol]
                  .quantityRestInvest > 0
              )
              //* обновление информации по инвестированному
              {
                //* уменьшение остатка
                if (tx.quantity < 0) {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestInvest =
                    // tx.quantity *
                    // agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev +
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev;
                }
                //* увеличение остатка
                else {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestInvest =
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev;
                }

                //* расчет обновленной цены
                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestInvest /
                  agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest || 0;

                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev =
                  agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest || 0;

                agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestInvest;
              }
              //* обнуление инвестирования
              else {
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest = 0;
                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest = 0;
                agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev = 0;
                agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev = 0;
                agg[tx.account][tx.portfolio][tx.symbol].costRestInvest = 0;
              }
            }

            //*остаток общий
            if (
              agg[tx.account][tx.portfolio][tx.symbol].quantityRest > 0
            ) {
              if (tx.quantity < 0) {
                agg[tx.account][tx.portfolio][tx.symbol].costRest =
                  tx.quantity *
                  agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev +
                  agg[tx.account][tx.portfolio][tx.symbol].costRestPrev;
              }
              else {
                agg[tx.account][tx.portfolio][tx.symbol].costRest =
                  tx.cost +
                  agg[tx.account][tx.portfolio][tx.symbol].costRestPrev;
              }

              agg[tx.account][tx.portfolio][tx.symbol].priceRest =
                agg[tx.account][tx.portfolio][tx.symbol].costRest /
                agg[tx.account][tx.portfolio][tx.symbol].quantityRest || 0;

              agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev =
                agg[tx.account][tx.portfolio][tx.symbol].priceRest || 0;

              agg[tx.account][tx.portfolio][tx.symbol].costRestPrev =
                agg[tx.account][tx.portfolio][tx.symbol].costRest;
            }
            else {
              agg[tx.account][tx.portfolio][tx.symbol].quantityRest = 0;
              agg[tx.account][tx.portfolio][tx.symbol].priceRest = 0;
              agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev = 0;
              agg[tx.account][tx.portfolio][tx.symbol].costRestPrev = 0;
              agg[tx.account][tx.portfolio][tx.symbol].costRest = 0;
            }

            //* остаток перелива 
            if (tx.isOverflow === true) {
              if (
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestOverflow > 0
              ) {
                if (tx.quantity < 0) {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow =
                    tx.quantity *
                    agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevOverflow +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow;
                }
                else {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow =
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow;
                }

                agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow /
                  agg[tx.account][tx.portfolio][tx.symbol].quantityRestOverflow || 0;

                agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow || 0;

                agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow;
              }
              else {
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestOverflow = 0;
                agg[tx.account][tx.portfolio][tx.symbol].priceRestOverflow = 0;
                agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevOverflow = 0;
                agg[tx.account][tx.portfolio][tx.symbol].costRestPrevOverflow = 0;
                agg[tx.account][tx.portfolio][tx.symbol].costRestOverflow = 0;
              }
            }

            //* остаток без перелива
            if (tx.isOverflow === false) {
              if (
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestWoOverflow > 0
              ) {
                if (tx.quantity < 0) {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow =
                    tx.quantity *
                    agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevWoOverflow +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow;
                }
                else {
                  agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow =
                    tx.cost +
                    agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow;
                }

                agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow /
                  agg[tx.account][tx.portfolio][tx.symbol].quantityRestWoOverflow || 0;

                agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevWoOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow || 0;

                agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow =
                  agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow;
              }
              else {
                agg[tx.account][tx.portfolio][tx.symbol].quantityRestWoOverflow = 0;
                agg[tx.account][tx.portfolio][tx.symbol].priceRestWoOverflow = 0;
                agg[tx.account][tx.portfolio][tx.symbol].priceRestPrevWoOverflow = 0;
                agg[tx.account][tx.portfolio][tx.symbol].costRestPrevWoOverflow = 0;
                agg[tx.account][tx.portfolio][tx.symbol].costRestWoOverflow = 0;
              }
            }

          }

          //* расчет реализованной прибыли
          if (
            operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
          ) {
            if (directionKey === outKey) {
              if (tx.isOverflow === false && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].pnlRealized +=
                  (tx.cost * -1) -
                  agg[tx.account][tx.portfolio][tx.symbol].priceRest *
                  (tx.quantity * -1);

                agg[tx.account][tx.portfolio][tx.symbol].costRealized +=
                  (tx.cost * -1);

                // agg[tx.account][tx.portfolio][tx.symbol].costRestInvest -=
                // agg[tx.account][tx.portfolio][tx.symbol].costRealized
                // agg[tx.account][tx.portfolio][tx.symbol].pnlRealized
              }
              if (tx.isOverflow === true && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].costTotal +=
                  (tx.cost * 1);
              }
            }
            if (directionKey === inKey) {
              if (tx.isOverflow === true && tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].costTotal +=
                  (tx.cost * -1);
              }
            }
          }

          //* расчет итоговой стоимости
          if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
            if (directionKey === inKey) {
              if (tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].costTotal +=
                  (tx.cost * 1);
              }
            }
            if (directionKey === outKey) {
              if (tx.isFee === false) {
                agg[tx.account][tx.portfolio][tx.symbol].costTotal +=
                  (tx.cost * 1);
              }
            }
          }

          //* Обнуление инвестиций сумме
          if (agg[tx.account][tx.portfolio][tx.symbol].costRestInvest < 0) {
            agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest = 0;
            agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest = 0;
            agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev = 0;
            agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev = 0;
            agg[tx.account][tx.portfolio][tx.symbol].costRestInvest = 0;
          }

          agg[tx.account][tx.portfolio][tx.symbol].operationCount += 1;

          // if (
          //   new Hash(tx.account).md5 === new Hash('ikeniborn').md5 &&
          //   new Hash(tx.symbol).md5 === new Hash('link').md5 &&
          //   new Hash(tx.portfolio).md5 === new Hash('main').md5
          // ) {
          //   console.log(
          //     'account:', tx.account, '\n'
          //     , 'dateTime', new FormatDate(tx.dateTime).getFormatDate('yyyy-MM-dd HH:mm'), '\n'
          //     , 'operation:', tx.operation, '\n'
          //     , 'portfolio:', tx.portfolio, '\n'
          //     , 'contractor:', tx.contractor, '\n'
          //     , 'symbol:', tx.symbol, '\n'
          //     , 'direction:', tx.direction, '\n'
          //     , '#############SIGN###############', '\n'
          //     , 'isOverflow:', tx.isOverflow, '\n'
          //     , 'isFee:', tx.isFee, '\n'
          //     , '#############OPERATION###############', '\n'
          //     , 'operationCount:', agg[tx.account][tx.portfolio][tx.symbol].operationCount, '\n'
          //     , 'quantity:', tx.quantity, '\n'
          //     , 'cost:', tx.cost, '\n'
          //     , 'price:', tx.cost / tx.quantity, '\n'
          //     , '#############RESTPORTFOLIO###############', '\n'
          //     , 'quantityRest:', agg[tx.account][tx.portfolio][tx.symbol].quantityRest, '\n'
          //     , 'priceRest:', agg[tx.account][tx.portfolio][tx.symbol].priceRest, '\n'
          //     , 'costRest:', agg[tx.account][tx.portfolio][tx.symbol].costRest, '\n'
          //     , 'priceRestPrev:', agg[tx.account][tx.portfolio][tx.symbol].priceRestPrev, '\n'
          //     , 'costRestPrev:', agg[tx.account][tx.portfolio][tx.symbol].costRestPrev, '\n'
          //     , '#############INVESTPORTFOLIO###############', '\n'
          //     , 'quantityRestInvest:', agg[tx.account][tx.portfolio][tx.symbol].quantityRestInvest, '\n'
          //     , 'priceRestInvest:', agg[tx.account][tx.portfolio][tx.symbol].priceRestInvest, '\n'
          //     , 'costRestInvest:', agg[tx.account][tx.portfolio][tx.symbol].costRestInvest, '\n'
          //     , 'priceRestInvestPrev:', agg[tx.account][tx.portfolio][tx.symbol].priceRestInvestPrev, '\n'
          //     , 'costRestInvestPrev:', agg[tx.account][tx.portfolio][tx.symbol].costRestInvestPrev, '\n'
          //     , '#############PNL###############', '\n'
          //     , 'costTotal:', agg[tx.account][tx.portfolio][tx.symbol].costTotal, '\n'
          //     , 'pnlRealized:', agg[tx.account][tx.portfolio][tx.symbol].pnlRealized, '\n'
          //     , 'costRealized:', agg[tx.account][tx.portfolio][tx.symbol].costRealized, '\n'
          //   )
          // }

          return agg
        }, {});

      //* расчет по контрагенту  
      const aggFlowContractor = transactions
        .reduce((agg, tx) => {
          const operationKey = new Hash(tx.operation).md5;
          const directionKey = new Hash(tx.direction).md5;

          // const dayInPortfolio = new FormatDate(tx.dateTime).diffBetweenDate()
          if (!agg[tx.account]) {
            agg[tx.account] = {};
          }

          if (!agg[tx.account][tx.portfolio]) {
            agg[tx.account][tx.portfolio] = {};
          }

          if (!agg[tx.account][tx.portfolio][tx.contractor]) {
            agg[tx.account][tx.portfolio][tx.contractor] = {};
          }

          if (!agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]) {
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol] = {
              quantityOverflowIn: 0,
              quantityOverflowOut: 0,
              quantityLock: 0,
              quantityRest: 0,
              precision: 0,
              operationCount: 0,
            };
          }

          //* Распределение количества по потокам

          if (operationKey === '0bd9f6dd716003f3818d15d2e211ee73' /*Overflow*/) {
            if (directionKey === inKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowIn += tx.quantity;
              }
            } else if (directionKey === outKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowOut += tx.quantity * -1;
              }
            }
          }
          else if (
            operationKey === '63275978133392f666f8fcc20f502304' /*Backflow*/
          ) {
            if (directionKey === inKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowIn += tx.quantity;
              }
            } else if (directionKey === outKey) {
              if (tx.isOverflow === true) {
                agg[tx.account][tx.portfolio][tx.contractor][
                  tx.symbol
                ].quantityOverflowOut += tx.quantity * -1;
              }
            }
          }

          //* Накопление остатков
          agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityRest += tx.quantity;

          //* Блокировки 
          if (tx.isLock) {
            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].quantityLock += tx.quantity;
          }

          //* расчет точности
          const precisionArray = tx.quantity.toString().split('.');
          const precision = precisionArray[1]
            ? [...precisionArray[1].split('')].length
            : 0;
          if (
            precision >
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
              .precision &&
            precision <= 6
          ) {
            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].precision = precision;
          } else if (
            precision >
            agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
              .precision &&
            precision > 6
          ) {
            agg[tx.account][tx.portfolio][tx.contractor][
              tx.symbol
            ].precision = 6;
          }

          // if (
          //   agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
          //     .quantityRest < 0
          // ) {
          //   agg[tx.account][tx.portfolio][tx.contractor][tx.symbol]
          //     .quantityRest = 0
          // }

          agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].operationCount += 1;

          // if (
          //   new Hash(account).md5 === new Hash('ikeniborn').md5 &&
          //   new Hash(symbol).md5 === new Hash('link').md5 &&
          //   new Hash(tx.portfolio).md5 === new Hash('main').md5 &&
          //   new Hash(tx.contractor).md5 === new Hash('safepal').md5
          // ) {
          //   console.log(
          //     'account:', tx.account, '\n'
          //     , 'dateTime', new FormatDate(tx.dateTime).getFormatDate('yyyy-MM-dd HH:mm'), '\n'
          //     , 'operation:', tx.operation, '\n'
          //     , 'portfolio:', tx.portfolio, '\n'
          //     , 'contractor:', tx.contractor, '\n'
          //     , 'symbol:', tx.symbol, '\n'
          //     , 'direction:', tx.direction, '\n'
          //     , '#############SIGN###############', '\n'
          //     , 'isOverflow:', tx.isOverflow, '\n'
          //     , 'isFee:', tx.isFee, '\n'
          //     , '#############OPERATION###############', '\n'
          //     , 'operationCount:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].operationCount, '\n'
          //     , 'quantity:', tx.quantity, '\n'
          //     , 'cost:', tx.cost, '\n'
          //     , 'price:', tx.cost / tx.quantity, '\n'
          //     , '#############RESTContractor###############', '\n'
          //     , 'quantityRest:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityRest, '\n'
          //     , 'quantityOverflowIn:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityOverflowIn, '\n'
          //     , 'quantityOverflowOut:', agg[tx.account][tx.portfolio][tx.contractor][tx.symbol].quantityOverflowOut, '\n'
          //   )
          // }


          return agg
        }, {});

      let aggFlowArrayOfObject = [];
      Object.entries(aggFlowContractor).forEach(([account, level0]) => {
        const portfolioCount = Object.keys(aggFlowPortfolio[account]).length;
        Object.entries(level0).forEach(([portfolio, level1]) => {
          Object.entries(level1).forEach(([contractor, level2]) => {
            Object.entries(level2).forEach(([symbol, object]) => {
              //* доп. атрибуты
              //* атрибуты символа
              const symbolKey = new Hash(symbol).md5;
              const symbolFullName = symbols[symbolKey]?.name || '';
              const symbolCategory = symbols[symbolKey]?.symbolCategory || '';
              const useInReport = symbols[symbolKey]?.useInReport ? 1 : 0;
              //* атрибуты контрагента
              const contractorKey = new Hash(contractor).md5;
              const contractorType = contractors[contractorKey]?.type || '';
              const contractorCategory = contractors[contractorKey]?.category || '';


              //* коэффициент точности по количеству
              let precisionCoeff = '1';
              for (let i = 0; i < object.precision; i++) {
                precisionCoeff += '0';
              }
              precisionCoeff = precisionCoeff * 1;

              //* стоимость остатка исторического
              let quantityRest = 0;
              let quantityLock = 0;

              quantityRest = Math.round(object.quantityRest * precisionCoeff) / precisionCoeff;

              if (object.quantityLock > 0) {
                quantityLock = Math.round(object.quantityLock * precisionCoeff) /
                  precisionCoeff;
              }

              let priceLast = 0;
              let priceRestOverflow = 0;
              let priceRestWoOverflow = 0;
              let priceRest = 0;
              let costLast = 0;
              let costLock = 0;
              let costTotal = 0;
              let costInvest = 0;
              let costRest = 0;
              let costRealized = 0;
              let pnlRealized = 0;
              let pnlUnrealized = 0;
              let pnlTotal = 0;
              let quantityOverflow = 0;
              let quantityRebalance = 0;
              let quantityInvest = 0;


              priceLast = symbols[symbolKey]?.price || 0;
              costLast = Math.round(priceLast * quantityRest * 100) / 100 || 0;
              costLock = priceLast * quantityLock;

              if (aggFlowPortfolio[account][portfolio][symbol]) {

                priceRest = aggFlowPortfolio[account][portfolio][symbol].priceRest;
                priceRestOverflow = aggFlowPortfolio[account][portfolio][symbol].priceRestOverflow;
                priceRestWoOverflow = aggFlowPortfolio[account][portfolio][symbol].priceRestWoOverflow;

                let allocationCoefficient = 0;

                if (aggFlowPortfolio[account][portfolio][symbol].quantityRest > 0) {
                  allocationCoefficient = quantityRest / aggFlowPortfolio[account][portfolio][symbol].quantityRest;
                } else {
                  allocationCoefficient = 1 / portfolioCount;
                }

                //* стоимость инвестиций
                costInvest = Math.round(
                  (aggFlowPortfolio[account][portfolio][symbol].costRestInvest * allocationCoefficient)
                ) || 0;

                //* стоимость остатка
                costRest =
                  Math.round(
                    (aggFlowPortfolio[account][portfolio][symbol].costRest * allocationCoefficient)
                  ) || 0;

                //* общая стоимость
                costTotal = Math.round(
                  (
                    aggFlowPortfolio[account][portfolio][symbol].costTotal
                    * allocationCoefficient
                  )
                ) || 0;

                //* реализованная прибыль
                costRealized =
                  Math.round(
                    (aggFlowPortfolio[account][portfolio][symbol].costRealized * allocationCoefficient)
                  ) || 0;

                //* реализованная прибыль
                pnlRealized =
                  Math.round(
                    (aggFlowPortfolio[account][portfolio][symbol].pnlRealized * allocationCoefficient)
                  ) || 0;

                //* не реализованная прибыль
                pnlUnrealized =
                  Math.round((costLast - costRest)) || 0;

                //* прибыль итоговая
                pnlTotal = pnlRealized + pnlUnrealized;


                //* Количество на ребалансировки от изменения цены

                if (priceLast !== 0 && priceRest !== 0) {
                  const changePriceCoef = priceLast / priceRest;
                  let priceRebalance =
                    priceLast + (priceRest - priceLast) * changePriceCoef;
                  if (priceRebalance < 0) {
                    priceRebalance = 0;
                  }
                  quantityRebalance =
                    (quantityRest * (priceRest - priceRebalance)) /
                    (priceRebalance - priceLast);
                }

                //* количество перелива
                quantityOverflow =
                  object.quantityOverflowIn -
                  object.quantityOverflowOut;

                //* количество инвестированного по текущей цене

                quantityInvest = costInvest / priceLast;

                // if (
                //   new Hash(account).md5 === new Hash('ikeniborn').md5 &&
                //   new Hash(symbol).md5 === new Hash('link').md5 &&
                //   new Hash(portfolio).md5 === new Hash('main').md5
                // ) {
                //   console.log(
                //     'account:', account, '\n'
                //     , 'portfolio:', portfolio, '\n'
                //     , 'contractor:', contractor, '\n'
                //     , 'symbol:', symbol, '\n'
                //     , '###aggFlowPortfolio###', '\n'
                //     , 'quantityRestInvest:', aggFlowPortfolio[account][portfolio][symbol].quantityRestInvest, '\n'
                //     , 'costRestInvest:', aggFlowPortfolio[account][portfolio][symbol].costRestInvest, '\n'
                //     , 'quantityRest:', aggFlowPortfolio[account][portfolio][symbol].quantityRest, '\n'
                //     , 'priceRest:', aggFlowPortfolio[account][portfolio][symbol].priceRest, '\n'
                //     , 'costTotal:', aggFlowPortfolio[account][portfolio][symbol].costTotal, '\n'
                //     , '###aggFlowContractor###', '\n'
                //     , 'allocationCoefficient:', allocationCoefficient, '\n'
                //     , 'quantityRest:', quantityRest, '\n'
                //     , 'quantityInvest:', quantityInvest, '\n'
                //     , 'quantityOverflow:', quantityOverflow, '\n'
                //     , 'costInvest:', costInvest, '\n'
                //     , 'costRest:', costRest, '\n'
                //     , 'costTotal:', costTotal, '\n'
                //     , 'pnlRealized:', pnlRealized, '\n'
                //     , 'pnlUnrealized:', pnlUnrealized, '\n'
                //     , 'pnlTotal:', pnlTotal, '\n'
                //   )
                // }
              }



              //* Расчет среднего времени в портфеле

              // const dayInPortfolioAvg =
              //   object.dayInPortfolioBuyInSum / object.quantityBuyIn ||
              //   0 + object.dayInPortfolioSellInSum / object.quantitySellIn ||
              //   0 +
              //   object.dayInPortfolioRefillInSum / object.quantityRefillIn ||
              //   0 +
              //   object.dayInPortfolioTransferInSum /
              //   object.quantityTransferIn ||
              //   -(
              //     object.dayInPortfolioBuyOutSum / object.quantityBuyOut ||
              //     0 +
              //     object.dayInPortfolioSellOutSum / object.quantitySellOut ||
              //     0 +
              //     object.dayInPortfolioWriteOffOutSum /
              //     object.quantityWriteOffOut ||
              //     0 +
              //     object.dayInPortfolioTransferOutSum /
              //     object.quantityTransferOut ||
              //     0
              //   )


              let symbolType = 'na';

              if (
                [
                  'e5e3fd01394b9a81296b75d5a7f4c1a2' /* Stablecoin */
                ].indexOf(
                  new Hash(symbolCategory).md5
                ) !== -1
              ) {
                symbolType = 'STABLECOIN';
              }
              else if (
                [
                  '7d5f30a0d1641c0b6980aaf2556b32ce' /* Fiat */
                ].indexOf(
                  new Hash(symbolCategory).md5
                ) !== -1
              ) {
                symbolType = 'FIAT';
              }
              else {
                symbolType = 'TOKEN';
              }

              aggFlowArrayOfObject.push({
                rowKey: new Hash(
                  account + portfolio + contractor + symbol
                ).md5,
                account: account.toUpperCase(),
                portfolio: portfolio.toUpperCase(),
                contractor: contractor.toUpperCase(),
                contractorType: contractorType.toUpperCase(),
                contractorCategory: contractorCategory.toUpperCase(),
                symbol: symbol.toUpperCase(),
                symbolFullName: symbolFullName.toUpperCase(),
                symbolCategory: symbolCategory.toUpperCase(),
                symbolType: symbolType.toUpperCase(),
                quantityInvest: quantityInvest || 0,
                // quantityBuy: quantityBuy || 0,
                // quantitySell: quantitySell || 0,
                // quantityTransfer: quantityTransfer || 0,
                quantityOverflow: quantityOverflow || 0,
                // quantitySell: quantitySell || 0,
                // quantityIn: quantityIn || 0,
                // quantityOut: quantityOut || 0,
                // quantityIn: quantityIn || 0,
                // quantityOut: quantityOut || 0,
                quantityRest: quantityRest || 0,
                quantityLock: quantityLock || 0,
                // quantityUnlock: quantityUnlock || 0,
                // priceIn: priceIn || 0,
                // priceOut: priceOut || 0,
                // priceInvest: priceInvest || 0,
                priceRest: priceRest || 0,
                priceRestOverflow: priceRestOverflow || 0,
                priceRestWoOverflow: priceRestWoOverflow || 0,
                priceLast: priceLast || 0,
                costTotal: costTotal || 0,
                // costSell: costSell || 0,
                // costBuyIn: object.costBuyIn || 0,
                // costBuyOut: object.costBuyOut || 0,
                // costRefillIn: object.costRefillIn || 0,
                // costSellIn: object.costSellIn || 0,
                // costSellOut: object.costSellOut || 0,
                // costWriteOffOut: object.costWriteOffOut || 0,
                // costTransferIn: object.costTransferIn || 0,
                // costTransferOut: object.costTransferOut || 0,
                // costTransfer: costTransfer || 0,
                // costOverflowIn: object.costOverflowIn || 0,
                // costOverflowOut: object.costOverflowOut || 0,
                // costOverflow: costOverflow || 0,
                // costIn: costIn || 0,
                // costOut: costOut || 0,
                costInvest: costInvest || 0,
                costRest: costRest || 0,
                costLast: costLast || 0,
                costLock: costLock || 0,
                costRealized: costRealized || 0,
                // costUnlock: costUnlock || 0,
                pnlRealized: pnlRealized || 0,
                pnlUnrealized: pnlUnrealized || 0,
                pnlTotal: pnlTotal || 0,
                quantityRebalance: quantityRebalance || 0,
                // dayInPortfolioAvg,
                isSell: 0,
                useInReport: useInReport || 0,
                updateDate: updateDate.getFormatDate('yyyy-MM-dd HH:mm'),
              });
            });
          });
        });
      });

      //* агрегация количества по символу
      const symbolsQuantityFlow = aggFlowArrayOfObject.reduce(
        (symbolQuantityFlow, rowFlow) => {
          if (!symbolQuantityFlow[rowFlow.account]) {
            symbolQuantityFlow[rowFlow.account] = {};
          }
          if (!symbolQuantityFlow[rowFlow.account][rowFlow.symbol]) {
            symbolQuantityFlow[rowFlow.account][rowFlow.symbol] = {
              quantityRest: 0,
              costRest: 0,
            };
          }
          symbolQuantityFlow[rowFlow.account][rowFlow.symbol].quantityRest +=
            rowFlow.quantityRest;

          symbolQuantityFlow[rowFlow.account][rowFlow.symbol].costRest +=
            rowFlow.costRest;
          return symbolQuantityFlow
        },
        {}
      );

      //* формирование признака продажи
      aggFlowArrayOfObject = aggFlowArrayOfObject.map((rowFlow) => {
        if (
          symbolsQuantityFlow[rowFlow.account][rowFlow.symbol].quantityRest <=
          0 ||
          Math.round(
            symbolsQuantityFlow[rowFlow.account][rowFlow.symbol].costRest
          ) <= 0
        ) {
          rowFlow.isSell = 1;
        }

        return rowFlow
      });

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject);
    } catch (error) {
      console.error('FlowSymbol.updateFlow', error.stack);
    }
  }

  updateFlowBalance() {
    try {
      const actualDate = new FormatDate().getDateBegin();
      const updateDataMart = new FormatDate().getDateBegin();
      const updateDate = new FormatDate();
      const flowBalance = new Portfolio().getWorkSheet('FlowBalance');
      const flowBalanceHistory = flowBalance.arrayOfObject.filter(
        (rowObject) => {
          return rowObject.updateDataMartKey !== actualDate.dateKey
        }
      );

      const aggFlowBalance = this.workSheet.arrayOfObject
        .filter((rowObject) => {
          return rowObject.useInReport == true
        })
        .reduce((agg, tx) => {
          if (!agg[tx.account]) {
            agg[tx.account] = {};
          }

          if (!agg[tx.account][tx.symbolCategory]) {
            agg[tx.account][tx.symbolCategory] = {
              costLast: 0,
            };
          }
          agg[tx.account][tx.symbolCategory].costLast += tx.costLast;
          return agg
        }, {});

      let aggFlowBalanceArrayOfObject = [];
      Object.entries(aggFlowBalance).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([symbolCategory, object]) => {
          aggFlowBalanceArrayOfObject.push({
            account: account.toUpperCase(),
            symbolCategory: symbolCategory.toUpperCase(),
            costLast: object.costLast || 0,
            updateDataMart: updateDataMart.getFormatDate('yyyy-MM-dd'),
            updateDate: updateDate.getFormatDate('yyyy-MM-dd HH:mm'),
            updateDataMartKey: updateDataMart.dateKey,
          });
        });
      });
      flowBalance.truncateInsertRows([
        ...flowBalanceHistory,
        ...aggFlowBalanceArrayOfObject,
      ]);
    } catch (error) {
      console.error('FlowSymbol.updateFlowBalance', error.stack);
    }
  }
}

class Overflows {
  constructor(workSheet = '') {
    if (Overflows.exists) {
      return Overflows.instance
    }
    Overflows.instance = this;
    Overflows.exists = true;
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Overflows');
  }

  updateOverflows() {
    try {
      const symbols = new Symbols().workSheet.object;
      const updateDataMart = new FormatDate();
      const inKey = new Hash('in').md5;
      const outKey = new Hash('out').md5;
      const transactions = new Transactions().workSheet.arrayOfObject;
      const transactionsOverflows = new FormatArray(transactions)
        .getCopy()
        .filter((rowObject) => {
          return rowObject.isDelete === false && rowObject.isOverflow === true
        });

      const transactionsFlow = new FormatArray(transactions)
        .getCopy()
        .filter((rowObject) => {
          return rowObject.isDelete === false && rowObject.isLock === false
        });

      const aggFlow = transactionsFlow.reduce((agg, tx) => {
        if (!agg[tx.account]) {
          agg[tx.account] = {};
        }
        if (!agg[tx.account][tx.symbol]) {
          agg[tx.account][tx.symbol] = {
            quantityRest: 0,
          };
        }
        agg[tx.account][tx.symbol].quantityRest += tx.quantity;
        return agg
      }, {});

      const aggOverflow = transactionsOverflows.reduce((agg, tx) => {
        const operationKey = new Hash(tx.operation).md5;
        const directionKey = new Hash(tx.direction).md5;
        const dayInOverflow = new FormatDate().diffBetweenDate(tx.dateTime);
        if (!agg[tx.account]) {
          agg[tx.account] = {};
        }
        let overflow;
        if (outKey === directionKey) {
          overflow = tx.overflow;
        } else if (inKey === directionKey) {
          overflow = tx.overflowRev;
        }

        if (!agg[tx.account][overflow]) {
          agg[tx.account][overflow] = {};
        }

        if (!agg[tx.account][overflow][tx.symbol]) {
          agg[tx.account][overflow][tx.symbol] = {
            quantityBuyIn: 0,
            quantityBuyOut: 0,
            quantitySellIn: 0,
            quantitySellOut: 0,
            quantityRefillIn: 0,
            quantityWriteOffOut: 0,
            quantityTransferIn: 0,
            quantityTransferOut: 0,
            quantityFlow: 0,
            priceCoefSumBuyIn: 0,
            priceCoefSumBuyOut: 0,
            priceCoefSumSellIn: 0,
            priceCoefSumSellOut: 0,
            priceCoefSumRefillIn: 0,
            priceCoefSumWriteOffOut: 0,
            priceCoefSumTransferIn: 0,
            priceCoefSumTransferOut: 0,
            dayInOverflowBuyInSum: 0,
            dayInOverflowBuyOutSum: 0,
            dayInOverflowSellOutSum: 0,
            dayInOverflowSellInSum: 0,
            dayInOverflowRefillInSum: 0,
            dayInOverflowWriteOffOutSum: 0,
            dayInOverflowTransferInSum: 0,
            dayInOverflowTransferOutSum: 0,
            // quantityRest: 0,
            // priceCoefRest: 0,
            // priceCoefRestPrev: 0,
            // priceCoefRestSum: 0,
            // priceCoefRestSumPrev: 0,
            // operationCount: 0,
          };
        }

        //* Распределение количества по потокам

        if (operationKey === '0461ebd2b773878eac9f78a891912d65' /*buy*/) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityBuyIn += tx.quantity;
            agg[tx.account][overflow][tx.symbol].priceCoefSumBuyIn +=
              tx.priceCoef * tx.quantity;
            agg[tx.account][overflow][tx.symbol].dayInOverflowBuyInSum +=
              dayInOverflow * tx.quantity;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
          else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityBuyOut +=
              tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].priceCoefSumBuyOut +=
              tx.priceCoef * tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].dayInOverflowBuyOutSum +=
              dayInOverflow * tx.quantity * -1;
            // * Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
        }
        else if (operationKey === '0bd9f6dd716003f3818d15d2e211ee73' /*Overflow*/) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityBuyIn += tx.quantity;
            agg[tx.account][overflow][tx.symbol].priceCoefSumBuyIn +=
              tx.priceCoef * tx.quantity;
            agg[tx.account][overflow][tx.symbol].dayInOverflowBuyInSum +=
              dayInOverflow * tx.quantity;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
          else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityBuyOut +=
              tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].priceCoefSumBuyOut +=
              tx.priceCoef * tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].dayInOverflowBuyOutSum +=
              dayInOverflow * tx.quantity * -1;
            // * Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
        }
        else if (
          operationKey === '8325324b47e1e62a1c2998a640cbdc72' /*sell*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantitySellIn += tx.quantity;
            agg[tx.account][overflow][tx.symbol].priceCoefSumSellIn +=
              tx.priceCoef * tx.quantity;
            agg[tx.account][overflow][tx.symbol].dayInOverflowSellInSum +=
              dayInOverflow * tx.quantity;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
          else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantitySellOut +=
              tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].priceCoefSumSellOut +=
              tx.priceCoef * tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].dayInOverflowSellOutSum +=
              dayInOverflow * tx.quantity * -1;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
        }
        else if (
          operationKey === '63275978133392f666f8fcc20f502304' /*backflow*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantitySellIn += tx.quantity;
            agg[tx.account][overflow][tx.symbol].priceCoefSumSellIn +=
              tx.priceCoef * tx.quantity;
            agg[tx.account][overflow][tx.symbol].dayInOverflowSellInSum +=
              dayInOverflow * tx.quantity;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
          else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantitySellOut +=
              tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].priceCoefSumSellOut +=
              tx.priceCoef * tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].dayInOverflowSellOutSum +=
              dayInOverflow * tx.quantity * -1;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
        }
        else if (
          operationKey === 'b4479040173a9f41eeb4e98339f2a21d' /*refill*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityRefillIn += tx.quantity;
            agg[tx.account][overflow][tx.symbol].priceCoefSumRefillIn +=
              tx.priceCoef * tx.quantity;
            agg[tx.account][overflow][tx.symbol].dayInOverflowRefillInSum +=
              dayInOverflow * tx.quantity;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
        }
        else if (
          operationKey === '7b33b9f52598cd60f7aa6ca0082515c4' /*write-off*/
        ) {
          if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityWriteOffOut +=
              tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].priceCoefSumWriteOffOut +=
              tx.priceCoef * tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].dayInOverflowWriteOffOutSum +=
              dayInOverflow * tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].dayInOverflowWriteOffOutSum +=
              dayInOverflow * tx.quantity * -1;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
        }
        else if (
          operationKey === '84a0f3455dcca894ace136be62efa292' /*transfer*/
        ) {
          if (directionKey === inKey) {
            agg[tx.account][overflow][tx.symbol].quantityTransferIn +=
              tx.quantity;
            agg[tx.account][overflow][tx.symbol].priceCoefSumTransferIn +=
              tx.priceCoef * tx.quantity;
            agg[tx.account][overflow][tx.symbol].dayInOverflowTransferInSum +=
              dayInOverflow * tx.quantity;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
          else if (directionKey === outKey) {
            agg[tx.account][overflow][tx.symbol].quantityTransferOut +=
              tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].priceCoefSumTransferOut +=
              tx.priceCoef * tx.quantity * -1;
            agg[tx.account][overflow][tx.symbol].dayInOverflowTransferOutSum +=
              dayInOverflow * tx.quantity * -1;
            //* Накопление остатков
            // agg[tx.account][overflow][tx.symbol].quantityRest += tx.quantity
          }
        }

        agg[tx.account][overflow][tx.symbol].quantityFlow += tx.quantity;

        //* Накопление остатков
        // if (
        //   agg[tx.account][overflow][tx.symbol]
        //     .operationCount === 0
        // ) {
        //   agg[tx.account][overflow][tx.symbol].priceCoefRestSum =
        //     tx.quantity * tx.priceCoef

        //   agg[tx.account][overflow][tx.symbol].priceCoefRestSumPrev =
        //     agg[tx.account][overflow][tx.symbol].priceCoefRestSum

        //   agg[tx.account][overflow][tx.symbol].priceCoefRestPrev =
        //     tx.priceCoef

        // } else {
        //   if (
        //     agg[tx.account][overflow][tx.symbol].quantityRest > 0
        //   ) {
        //     if (tx.quantity < 0) {
        //       agg[tx.account][overflow][tx.symbol].priceCoefRestSum =
        //         tx.quantity *
        //         agg[tx.account][overflow][tx.symbol]
        //           .priceCoefRestPrev +
        //         tx.quantity * tx.priceCoef
        //     } else {
        //       agg[tx.account][overflow][tx.symbol].priceCoefRestSum =
        //         tx.quantity * tx.priceCoef +
        //         agg[tx.account][overflow][tx.symbol].priceCoefRestSumPrev
        //     }

        //     agg[tx.account][overflow][tx.symbol].priceCoefRest =
        //       agg[tx.account][overflow][tx.symbol]
        //         .priceCoefRestSum /
        //       agg[tx.account][overflow][tx.symbol]
        //         .quantityRest || 0

        //     agg[tx.account][overflow][tx.symbol].priceCoefRestPrev =
        //       agg[tx.account][overflow][tx.symbol]
        //         .priceCoefRest || 0

        //     agg[tx.account][overflow][tx.symbol].priceCoefRestSumPrev =
        //       agg[tx.account][overflow][tx.symbol].priceCoefRestSum
        //   } else {
        //     agg[tx.account][overflow][tx.symbol].priceCoefRest = 0
        //     agg[tx.account][overflow][tx.symbol].priceCoefRestPrev = 0
        //     agg[tx.account][overflow][tx.symbol].priceCoefRestSum = 0
        //     agg[tx.account][overflow][tx.symbol].priceCoefRestSumPrev = 0
        //   }
        // }

        // agg[tx.account][overflow][tx.symbol].operationCount += 1


        return agg
      }, {});

      transactions.forEach((tx) => {
        let overflow;
        const directionKey = new Hash(tx.direction).md5;
        if (outKey === directionKey) {
          overflow = tx.overflowRev;
        } else if (inKey === directionKey) {
          overflow = tx.overflow;
        }

        if (aggOverflow[tx.account]) {
          if (aggOverflow[tx.account][overflow]) {
            if (aggOverflow[tx.account][overflow][tx.symbol]) {
              aggOverflow[tx.account][overflow][tx.symbol].quantityRest +=
                tx.quantity;
            }
          }
        }
      });

      const aggFlowObject = {};
      Object.entries(aggOverflow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([overflow, level1]) => {
          Object.entries(level1).forEach(([symbol, object]) => {
            //* расчет потоков
            const priceCoefSumIn =
              object.priceCoefSumBuyIn +
              object.priceCoefSumSellIn +
              object.priceCoefSumRefillIn +
              object.priceCoefSumTransferIn;

            const priceCoefSumOut =
              object.priceCoefSumBuyOut +
              object.priceCoefSumSellOut +
              object.priceCoefSumWriteOffOut +
              object.priceCoefSumTransferOut;

            const quantityInFlow =
              object.quantityBuyIn +
              object.quantitySellIn +
              object.quantityRefillIn +
              object.quantityTransferIn;

            const quantityOutFlow =
              object.quantityBuyOut +
              object.quantitySellOut +
              object.quantityWriteOffOut +
              object.quantityTransferOut;

            //* Расчет среднего времени в портфеле

            const dayInOverflowAvg =
              object.dayInOverflowBuyInSum / object.quantityBuyIn ||
              0 + object.dayInOverflowSellInSum / object.quantitySellIn ||
              0 + object.dayInOverflowRefillInSum / object.quantityRefillIn ||
              0 +
              object.dayInOverflowTransferInSum / object.quantityTransferIn ||
              -(
                object.dayInOverflowBuyOutSum / object.quantityBuyOut ||
                0 + object.dayInOverflowSellOutSum / object.quantitySellOut ||
                0 +
                object.dayInOverflowWriteOffOutSum /
                object.quantityWriteOffOut ||
                0 +
                object.dayInOverflowTransferOutSum /
                object.quantityTransferOut ||
                0
              );

            //* показатели
            const quantityFlow = object.quantityFlow;
            // const quantityRest = object.quantityRest
            const priceCoefSumInFlow = priceCoefSumIn / quantityInFlow || 0;
            const priceCoefSumOutFlow = priceCoefSumOut / quantityOutFlow || 0;
            const priceCoefSumFlowSum =
              priceCoefSumInFlow * quantityInFlow +
              priceCoefSumOutFlow * quantityOutFlow;
            const quantityFlowSum = quantityInFlow + quantityOutFlow;
            const priceCoefFlow = priceCoefSumFlowSum / quantityFlowSum;
            // const priceCoefRest = object.priceCoefRestSum / object.quantityRest


            if (!aggFlowObject[account]) {
              aggFlowObject[account] = {};
            }

            if (!aggFlowObject[account][overflow]) {
              aggFlowObject[account][overflow] = {
                dayInOverflowAvg: Math.abs(dayInOverflowAvg),
                tokenA: '',
                tokenARestQuantity: 0,
                tokenAOverFlowQuantity: 0,
                // tokenAOverFlowQuantityRest: 0,
                ABPriceCoefFlow: 0,
                // ABPriceCoefRest: 0,
                tokenAPrice: 0,
                tokenB: '',
                tokenBRestQuantity: 0,
                tokenBOverFlowQuantity: 0,
                // tokenBOverFlowQuantityRest: 0,
                BAPriceCoefFlow: 0,
                // BAPriceCoefRest: 0,
                tokenBPrice: 0,
              };
            }

            if (quantityFlow < 0) {
              const tokenAKey = new Hash(symbol).md5;
              aggFlowObject[account][overflow].tokenA = symbol;
              aggFlowObject[account][
                overflow
              ].tokenAOverFlowQuantity = quantityFlow;
              // aggFlowObject[account][
              //   overflow
              // ].tokenAOverFlowQuantityRest = quantityRest
              aggFlowObject[account][overflow].ABPriceCoefFlow = priceCoefFlow;
              // aggFlowObject[account][overflow].ABPriceCoefRest = priceCoefRest
              aggFlowObject[account][overflow].tokenAPrice =
                symbols[tokenAKey]?.price || 0;
            }

            if (quantityFlow > 0) {
              const tokenBKey = new Hash(symbol).md5;
              aggFlowObject[account][overflow].tokenB = symbol;
              aggFlowObject[account][
                overflow
              ].tokenBOverFlowQuantity = quantityFlow;
              // aggFlowObject[account][
              //   overflow
              // ].tokenBOverFlowQuantityRest = quantityRest
              aggFlowObject[account][overflow].BAPriceCoefFlow = priceCoefFlow;
              // aggFlowObject[account][overflow].BAPriceCoefRest = priceCoefRest
              aggFlowObject[account][overflow].tokenBPrice =
                symbols[tokenBKey]?.price || 0;
            }
          });
        });
      });
      const aggFlowArrayOfObject = [];
      Object.entries(aggFlowObject).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([overflow, object]) => {
          const overflowArray = overflow.split('/');
          const tokenA = overflowArray[0];
          const tokenB = overflowArray[1];
          const tokenAKey = new Hash(overflowArray[0]).md5;
          const tokenBKey = new Hash(overflowArray[1]).md5;
          const backflow = tokenB + '/' + tokenA;
          const ABPriceCoef = object.tokenAPrice / object.tokenBPrice;
          const BAPriceCoef = object.tokenBPrice / object.tokenAPrice;
          const ABPriceCoefDiffPct = object.ABPriceCoefFlow
            ? ABPriceCoef / object.ABPriceCoefFlow - 1
            : 0;
          // const ABPriceCoefRestDiffPct = object.ABPriceCoefRest
          //   ? ABPriceCoef / object.ABPriceCoefRest - 1
          //   : 0
          const tokenARestQuantity =
            aggFlow[account][object.tokenA]?.quantityRest || 0;
          const tokenBRestQuantity =
            aggFlow[account][object.tokenB]?.quantityRest || 0;

          if (
            symbols[tokenAKey]?.useInReport === true &&
            symbols[tokenBKey]?.useInReport === true
          ) {
            aggFlowArrayOfObject.push({
              account: account.toUpperCase(),
              dayInOverflowAvg: object.dayInOverflowAvg,
              overflow: overflow.toUpperCase(),
              backflow: backflow.toUpperCase(),
              tokenA: object.tokenA ? object.tokenA.toUpperCase() : void 0,
              tokenARestQuantity: tokenARestQuantity,
              tokenAOverFlowQuantity: Math.abs(object.tokenAOverFlowQuantity),
              // tokenAOverFlowQuantityRest: Math.abs(object.tokenAOverFlowQuantityRest),
              tokenABackFlowMaxPlanQuantity:
                object.tokenBOverFlowQuantity / ABPriceCoef,
              tokenB: object.tokenB ? object.tokenB.toUpperCase() : void 0,
              tokenBRestQuantity: tokenBRestQuantity,
              tokenBOverFlowQuantity: object.tokenBOverFlowQuantity,
              // tokenBOverFlowQuantityRest: object.tokenBOverFlowQuantityRest,
              ABPriceCoefFlow: object.ABPriceCoefFlow,
              // ABPriceCoefRest: object.ABPriceCoefRest,
              ABPriceCoef: ABPriceCoef,
              BAPriceCoef: BAPriceCoef,
              ABPriceCoefDiffPct: ABPriceCoefDiffPct,
              // ABPriceCoefRestDiffPct: ABPriceCoefRestDiffPct,
              updateDataMart: updateDataMart.getFormatDate(
                'yyyy-MM-dd HH:mm:ss'
              ),
            });
          }
        });
      });

      const sortAggFlowArrayOfObject = aggFlowArrayOfObject
        .sort((a, b) => {
          return b.dayInOverflowAvg - a.dayInOverflowAvg
        })
        .sort((a, b) => {
          return a.ABPriceCoefDiffPct - b.ABPriceCoefDiffPct
        });

      //* расчет количества обратного перелива для токена А
      const tokenAbackflowArrayOfObject = sortAggFlowArrayOfObject.reduce(
        (backflowObject, object) => {
          if (!backflowObject[object.backflow]) {
            backflowObject[object.backflow] = {};
          }

          if (!backflowObject[object.backflow][object.tokenB]) {
            backflowObject[object.backflow][object.tokenB] = {
              tokenABackFlowQuantity: 0,
              // tokenABackFlowQuantityRest: 0,
              dayInBackFlowAvg: 0,
            };
          }
          backflowObject[object.backflow][
            object.tokenB
          ].tokenABackFlowQuantity += object.tokenBOverFlowQuantity;
          // backflowObject[object.backflow][
          //   object.tokenB
          // ].tokenABackFlowQuantityRest += object.tokenBOverFlowQuantityRest
          backflowObject[object.backflow][object.tokenB].dayInBackFlowAvg +=
            object.dayInOverflowAvg;
          return backflowObject
        },
        {}
      );

      sortAggFlowArrayOfObject.map((object) => {
        object.tokenABackFlowQuantity = 0;
        // object.tokenABackFlowQuantityRest = 0
        object.dayInBackFlowAvg = 0;

        if (!tokenAbackflowArrayOfObject[object.overflow]) {
        } else {
          if (!tokenAbackflowArrayOfObject[object.overflow][object.tokenA]) {
          } else {
            object.tokenABackFlowQuantity =
              tokenAbackflowArrayOfObject[object.overflow][
                object.tokenA
              ].tokenABackFlowQuantity;
            // object.tokenABackFlowQuantityRest =
            //   tokenAbackflowArrayOfObject[object.overflow][
            //     object.tokenA
            //   ].tokenABackFlowQuantityRest
            object.dayInBackFlowAvg =
              tokenAbackflowArrayOfObject[object.overflow][
                object.tokenA
              ].dayInBackFlowAvg;
          }
        }

        //* расчет эффективности перелива
        const tokenAKey = new Hash(object.tokenA).md5;

        object.tokenAOverflowPnlQty =
          object.tokenABackFlowQuantity - object.tokenAOverFlowQuantity;
        // object.tokenAOverflowPnlRestQty =
        //   object.tokenABackFlowQuantityRest - object.tokenAOverFlowQuantityRest
        object.tokenAOverflowPnlQtyPct =
          (object.tokenABackFlowQuantity - object.tokenAOverFlowQuantity) /
          object.tokenAOverFlowQuantity;
        // object.tokenAOverflowPnlRestQtyPct =
        //   (object.tokenABackFlowQuantityRest - object.tokenAOverFlowQuantityRest) /
        //   object.tokenAOverFlowQuantityRest

        if (object.tokenAOverflowPnlQty > 0) {
          object.tokenAOverflowCostFreeze = 0;
        } else {
          object.tokenAOverflowCostFreeze =
            (object.tokenAOverFlowQuantity - object.tokenABackFlowQuantity) *
            symbols[tokenAKey].price;
        }

        // if (object.tokenAOverflowPnlRestQty > 0) {
        //   object.tokenAOverflowCostFreezeRest = 0
        // } else {
        //   object.tokenAOverflowCostFreezeRest =
        //     (object.tokenAOverFlowQuantityRest - object.tokenABackFlowQuantityRest) *
        //     symbols[tokenAKey].price
        // }

        //* расчет остатка перелива в токена Б
        object.tokenBBackFlowMinPlanQuantity =
          (object.tokenAOverFlowQuantity - object.tokenABackFlowQuantity) *
          object.ABPriceCoef;

        //* расчет среднего интервала перелива
        object.dayInFlowAvg = Math.abs(
          object.dayInOverflowAvg - object.dayInBackFlowAvg
        );

        //* статус перелива
        if (object.ABPriceCoefDiffPct < 0) {
          object.overflowStatus = 'Backflow';
        } else if (object.ABPriceCoefDiffPct >= 0) {
          object.overflowStatus = 'Overflow';
        }
        // if (object.ABPriceCoefRestDiffPct < 0) {
        //   object.overflowStatusRest = 'Backflow'
        // } else if (object.ABPriceCoefRestDiffPct >= 0) {
        //   object.overflowStatusRest = 'Overflow'
        // }

        return object
      });

      this.workSheet.truncateInsertRows(sortAggFlowArrayOfObject);
    } catch (error) {
      console.error('Overflows.updateOverflows', error.stack);
    }
  }
}

// import { GasProcess } from '../restApi/gasScriptApi'

function createMenu() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Portfolio');
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Service')
      .addItem('Update prices', 'updatePrices')
      .addItem('Update flow', 'updateFlow')
      .addItem('Update flow balance', 'updateFlowBalance')
      .addItem('Update overflows', 'updateOverflows')
      .addItem('Update coins', 'updateCoins')
      .addItem('Validate transactions', 'validateTransactions')
  );
  menu.addItem('Sort registry', 'sortRegistry');
  menu.addToUi();
}

function cleanAllMetadata() {
  const activeWorkSheet = SpreadsheetApp.getActiveSheet();
  console.log('activeWorkSheet: ', activeWorkSheet.getName());
  new WorkSheetMetadata(activeWorkSheet).metadata.deleteAllMetadata();
}

// function getCategory() {
//   new Web3Space().getCategory()
// }

function getCategories() {
  console.log(new Category().getCategories());
}

function updateLPToken() {
  new LPToken().updateLPToken();
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

function validateTransactions() {
  const startProcess = new FormatDate();
  new Promise((resolve, reject) => {
    const process = () => {
      new Registry().validateTransactions();
      return true
    };
    process() ? resolve() : reject(new Error('script.validateTransactions'));
  })
    .then(
      new Portfolio().log.addMessage(
        'script.validateTransactions',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.validateTransactions', error.stack);
    });
}

function updateCoins() {
  const startProcess = new FormatDate();
  try {
    new Coins().updateCoins();
  } catch (error) {
    console.error('script.updateCoins', error.stack);
  } finally {
    new Portfolio().log.addMessage(
      'script.updateCoins',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    );
  }
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
      new Portfolio().log.addMessage(
        'script.updatePrices',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updatePrices', error.stack);
    });
}

function updateFlow() {
  const startProcess = new FormatDate();
  new Promise((resolve, reject) => {
    const process = () => {
      new Flow().updateFlow();
      return true
    };
    process() ? resolve() : reject(new Error('script.updateFlow'));
  })
    .then(
      new Portfolio().log.addMessage(
        'updateFlow',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updateFlow', error.stack);
    });
}

function updateFlowBalance() {
  const startProcess = new FormatDate();
  new Promise((resolve, reject) => {
    const process = () => {
      new Flow().updateFlowBalance();
      return true
    };
    process() ? resolve() : reject(new Error('script.updateFlowBalance'));
  })
    .then(
      new Portfolio().log.addMessage(
        'updateFlowBalance',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updateFlowBalance', error.stack);
    });
}

function updateOverflows() {
  const startProcess = new FormatDate();
  new Promise((resolve, reject) => {
    const process = () => {
      new Overflows().updateOverflows();
      return true
    };
    process() ? resolve() : reject(new Error('script.updateOverflows'));
  })
    .then(
      new Portfolio().log.addMessage(
        'script.updateOverflows',
        'ID:' + startProcess.value,
        'Time spent: ' + startProcess.getTimeDiff()
      )
    )
    .catch((error) => {
      console.error('script.updateOverflows', error.stack);
    });
}

function deleteDisabledTrigger() {
  new SpreadsheetsTrigger().deleteDisabledTrigger();
}

function updatePortfolio() {
  new SpreadsheetsTrigger().createForSpreadsheetArter('updatePrices', 1);
  new SpreadsheetsTrigger().createForSpreadsheetArter('updateFlow', 300);
  new SpreadsheetsTrigger().createForSpreadsheetArter('updateFlowBalance', 600);
  new SpreadsheetsTrigger().createForSpreadsheetArter('updateOverflows', 900);
  new SpreadsheetsTrigger().createForSpreadsheetArter(
    'deleteDisabledTrigger',
    930
  );
}

function updateRegistryRowKey() {
  new Transactions().updateRegistryRowKey();
}

function updateRowKey() {
  new Transactions().updateRowKey();
}

function updateIsOverflow() {
  new Transactions().updateIsOverflow();
}

function updatePair() {
  new Transactions().updatePair();
}

function updatePriceCostBTC(startIndex, endIndex) {
  new Transactions().updatePriceCostBTC(startIndex, endIndex);
}

function updateHistoricalAveragePriceKey() {
  new Transactions().updateHistoricalAveragePriceKey();
}

function updateAccount() {
  new Transactions().updateAccount();
}

function updateOnEdit(editRange) {
  try {
    const startProcess = new FormatDate();
    const lock = LockService.getScriptLock();
    const savingDialog = new ModalDialog('html/SavingProcess', 300, 100);
    let startDialog = false;
    if (editRange.range.rowEnd - editRange.range.rowStart > 0) {
      startDialog = true;
    }
    new Promise((resolve, reject) => {
      const workSheet = new Portfolio().updateOnEdit(editRange.range);
      if (workSheet.isChangeData) {
        const startLock = new FormatDate();
        lock.tryLock(180000);
        if (startDialog) {
          savingDialog.showModalDialog('Saving process');
          startDialog = true;
        } else {
          SpreadsheetApp.getActive().toast('Start saving...', 'Process', 1);
        }
        workSheet.lockTime = startLock.getTimeDiff();
        if (workSheet.isChangePrimaryKey) {
          workSheet.savePrimaryKeyChanges();
        }
        if (workSheet.workSheetKey === new Hash('symbols').md5) {
          new Symbols(workSheet).updateId();
        } else if (workSheet.isRegistry) {
          new Promise((resolve) => {
            const registry = new Registry(workSheet);
            registry.deleteDateSaved();
            resolve(registry);
          }).then((registry) => {
            registry.updateTransactions(true);
          });
        }
        resolve(workSheet);
      } else {
        reject(workSheet);
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
        );
        lock.releaseLock();
        if (startDialog) {
          savingDialog.closeModalDialog('All row saved!', 200);
        }
      })
      .catch((workSheet) => {
        // if (startDialog) {
        //   savingDialog.closeModalDialog('All row saved!', 200)
        // } else {
        //   SpreadsheetApp.getActive().toast('End saving...', 'Process', 1)
        // }
        console.error('script.updateOnEdit', workSheet.sheetName);
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
  //* обработка фильтрации
  const filter = {};
  filter.customFilter = activeSheet.getFilter();
  if (filter.customFilter) {
    filter.isExist = true;
    for (let i = 1; i <= this.maxColumn; i++) {
      const criteria = filter.customFilter.getColumnFilterCriteria(i);
      if (criteria !== null) {
        filter.columnPosition = i;
        filter.filterCriteria = criteria.copy();
        break
      }
    }
    if (filter.columnPosition) {
      filter.customFilter.remove();
    }
  }
  //* сортировка регистра
  const activeWorkSheet = new Portfolio().getWorkSheet(activeSheet.getName());
  if (activeWorkSheet.isRegistry) {
    const registry = new Registry(activeWorkSheet);
    registry.filter = filter;
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
