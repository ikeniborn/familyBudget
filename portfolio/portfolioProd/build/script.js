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
   * @param {date} endDate - Дата окончания
   * @returns Количество полных дней
   */
  diffBetweenDate(endDate) {
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

  getPrimaryKey(head = {}, rowValues = {}) {
    return new Hash(
      Object.keys(head)
        .filter((column) => head[column].pk)
        .map((column) => {
          const value = rowValues[column];
          if (value instanceof Date) {
            return new Date(value).valueOf()
          } else {
            return value
          }
        })
        .join('')
    ).md5
  }

  isChangePrimaryKey(head, rowValues = {}) {
    return Object.keys(head)
      .filter((column) => head[column].pk)
      .some((column) => (rowValues[column] ? true : false))
  }

  isNotNull(head, rowValues = {}) {
    const data = Object.keys(head).filter((column) => head[column].notNull);
    if (data.length) {
      return data.every((column) => rowValues[column])
    }
    return false
  }
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
    if (WorkSheet.key === new Hash(sheetName).md5) {
      return WorkSheet.instance
    }
    WorkSheet.instance = this;
    this.workSheetKey = new Hash(sheetName).md5;
    this.sheetName = sheetName;
    this.headType = head.type;
    this.head = head.columns;
    this.headKey = Object.keys(this.head);
    this.headRowNum = head.rowNum;
    this.firstRowNum = this.headRowNum + 1;
    this.workSheet = this.workSheets[this.workSheetKey];
    this.range = this.workSheet.getDataRange();
    this.countRow = this.range.getNumRows() - this.headRowNum;
    this.countColumn = this.range.getNumColumns();
    this.isRange = false;
    this.dataRange =
      this.countRow > 0
        ? this.workSheet
            .getDataRange()
            .offset(this.headRowNum, 0, this.countRow, this.countColumn)
        : this.workSheet
            .getDataRange()
            .offset(this.headRowNum - 1, 0, 1, this.countColumn);
    // this.metadata = new WorkSheetMetadata(this.workSheet)
    this.arrayOfObject = [];
    this.object = {};
    this.getDataset();
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
      const rowKey = new Hash(rowNum + this.sheetName).md5;
      const instanceRow = arrayRow.reduce((object, value, column) => {
        object['rowKey'] = rowKey;
        object['rowNum'] = rowNum;
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

  truncateInsertRows(arrayOfObject = [], firstRow = 1, firstColumn = 1) {
    const array = arrayOfObject.reduce(
      (values, rowObject) => {
        const rowArray = this.headKey.map((column) => {
          let value = rowObject[column];
          if (this.head[column]?.default && !value) {
            value = this.head[column].default;
          }
          if (this.head[column]?.type === 'date') {
            return new Date(value)
          } else {
            return value
          }
        });
        values.push(rowArray);
        return values
      },
      [new Header().getHeaderAlias(this.head)]
    );
    if (array.length) {
      this.deleteFilter();
      this.workSheet
        .clear()
        .getRange(firstRow, firstColumn, array.length, array[0].length)
        .setValues(array);
      this.deleteEmptyRows().deleteEmptyColumns();
    }
    return this
  }

  updateRow(object = {}) {
    try {
      if (object.rowNum !== this.headerRowNum) {
        const array = [
          this.headKey.map((column) => {
            let value = object[column];
            if (this.head[column]?.default && !value) {
              value = this.head[column].default;
            }
            if (this.head[column]?.type === 'date') {
              return new Date(value)
            } else {
              return value
            }
          }),
        ];
        // this.deleteFilter()
        this.workSheet
          .getRange(object.rowNum, 1, array.length, array[0].length)
          .setValues(array);
        this.deleteEmptyRows().deleteEmptyColumns();
      }
    } catch (error) {
      console.error('WorkSheet.updateRow', error.stack);
    }
  }

  insertRow(object = {}) {
    try {
      const array = this.headKey.map((column) => {
        let value = object[column];
        if (this.head[column]?.default && !value) {
          value = this.head[column].default;
        }
        if (this.head[column]?.type === 'date') {
          return new Date(value)
        } else {
          return value
        }
      });
      this.workSheet.appendRow(array);
      this.deleteEmptyRows().deleteEmptyColumns();
    } catch (error) {
      console.error('WorkSheet.insertRow', error.stack);
    }
  }

  insertValue(value, rowNum, column) {
    if (rowNum !== this.headerRowNum) {
      this.workSheet.getRange(rowNum, column).setValue(value);
    }
  }
  /**
   *
   * @param {number} rowNum
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
        console.log('deleteRows', row.rowNum);
        this.deleteRow(row.rowNum);
      });
    }
  }

  deleteFilter() {
    this.customFilter = this.workSheet.getFilter();
    if (this.customFilter) {
      this.customFilter.remove();
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
      this.getDimension();
    } else if (this.headType === 'fct') {
      this.getFact();
    } else if (this.headType === 'tx') {
      this.getTransactions();
    }
    return this
  }
}

class WorkSheetRange extends WorkSheet {
  constructor(spreadSheetName, sheetName, head, range) {
    super(spreadSheetName, sheetName, head);
    this.range = range;
    this.countRow = this.range.rowEnd - this.range.rowStart + 1;
    this.countColumn = this.range.columnEnd - this.range.columnStart + 1;
    this.firstRowNum = this.range.rowStart;
    this.isChangePrimaryKey = false;
    this.isNotNull = false;
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
    this.arrayOfObject = [];
    this.object = {};
    this.getDataset();
  }

  get isDeleteRow() {
    return this.countColumn === this.maxColumn
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
        const object = arrayRow.reduce((object, value, index) => {
          if (!object[this.headKey[index]]) {
            object[this.headKey[index]] = value;
          }
          object['rowNum'] = rowNum;
          return object
        }, {});
        const newRowKey = new Header().getPrimaryKey(this.head, object);
        object.isChangePrimaryKey = false;
        if (object.rowKey !== newRowKey) {
          object.rowKey = newRowKey;
          this.isChangePrimaryKey = true;
        }
        if (!objectRow[object.rowKey]) {
          objectRow[object.rowKey] = object;
        }
        this.isNotNull = new Header().isNotNull(this.head, object);
        return objectRow
      }, {});
    this.arrayOfObject = Object.values(this.object);
    return this
  }

  getTransactions() {
    try {
      this.dataRange.getValues().forEach((arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow;
        const rowKey = new Hash(rowNum + this.sheetName).md5;
        const instanceRow = arrayRow.reduce((object, value, column) => {
          if (!object[this.headKey[column]]) {
            object[this.headKey[column]] = value;
            object['rowKey'] = rowKey;
            object['rowNum'] = rowNum;
          }
          return object
        }, {});
        if (!this.object[rowKey]) {
          this.object[rowKey] = instanceRow;
          this.isNotNull = new Header().isNotNull(this.head, instanceRow);
        }
        this.arrayOfObject.push(instanceRow);
      });
      return this
    } catch (error) {
      console.error('WorkSheetRange.getTransactions', error.stack);
    }
  }

  savePrimaryKeyChanges() {
    if (this.firstRowNum !== this.headRowNum) {
      this.arrayOfObject.forEach((object) => {
        this.updateRow(object);
      });
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
          project: { alias: 'Project', idx: 3 },
          platform: { alias: 'Platform', idx: 4, notNull: true },
          service: { alias: 'Service', idx: 5, notNull: true },
          sender: { alias: 'Sender', idx: 6, notNull: true },
          recipient: { alias: 'Recipient', idx: 7 },
          isLock: { alias: 'Is lock', idx: 8 },
          coin: { alias: 'Coin', idx: 9, notNull: true },
          coinQty: { alias: 'Coin, qty', idx: 10 },
          currency: { alias: 'Currency', idx: 11 },
          currencyQty: { alias: 'Currency, qty', idx: 12 },
          currencyPerCoin: { alias: 'Currency per coin', idx: 13 },
          feeCurrency: { alias: 'Fee currency', idx: 14 },
          feeQty: { alias: 'Fee, qty', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          date: { alias: 'Date', idx: 17, notNull: true, type: 'date' },
          time: { alias: 'Time', idx: 18, notNull: true },
          isDelete: { alias: 'Is delete', idx: 19 },
        },
      },
      prices: {
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
          symbolType: {
            alias: 'Symbol type',
            idx: 4,
            notNull: true,
          },
          category: {
            alias: 'Category',
            idx: 5,
            notNull: true,
          },
          proofType: {
            alias: 'Proof type',
            idx: 6,
          },
          ecosystem: {
            alias: 'Ecosystem',
            idx: 7,
          },
          riskCategory: { alias: 'Risk category', idx: 8 },
          id: { alias: 'Id', idx: 9 },
          price: { alias: 'Price', idx: 10 },
          update: {
            alias: 'Update',
            idx: 11,
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
          sourceName: { alias: 'Source name', idx: 2 },
          dateTime: { alias: 'Date and time', idx: 3, type: 'date' },
          operation: { alias: 'Operation', idx: 4 },
          direction: { alias: 'Direction', idx: 5 },
          account: { alias: 'Account', idx: 6 },
          platform: { alias: 'Platform', idx: 7 },
          service: { alias: 'Service', idx: 8 },
          project: { alias: 'Project', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          mainSymbol: { alias: 'Main coin', idx: 11 },
          symbol: { alias: 'Coin', idx: 12 },
          quantity: { alias: 'Quantity', idx: 13 },
          price: { alias: 'Price', idx: 14 },
          cost: { alias: 'Cost', idx: 15 },
          comment: { alias: 'Comment', idx: 16 },
          isDelete: { alias: 'Delete', idx: 17 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 19 },
          isFee: { alias: 'Is fee', idx: 19 },
          isLock: { alias: 'Is lock', idx: 20 },
          isBuyPrice: { alias: 'Is buy price', idx: 21 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 22,
          },
          registryRowNum: { alias: 'Registry row num', idx: 23 },
          updateDate: {
            alias: 'Update',
            idx: 24,
            type: 'date',
            default: new Date(),
          },
        },
      },
      flowSymbol: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          symbol: { alias: 'Symbol', idx: 1 },
          symbolKey: { alias: 'Symbol key', idx: 2 },
          quantityInFlow: { alias: 'Quantity in flow', idx: 3 },
          quantityOutFlow: { alias: 'Quantity out flow', idx: 4 },
          quantityRest: { alias: 'Quantity rest', idx: 5 },
          priceInFlow: { alias: 'Price in flow', idx: 6 },
          priceOutFlow: { alias: 'Price out flow', idx: 7 },
          priceRest: { alias: 'Price rest', idx: 8 },
          costInFlow: { alias: 'Cost in flow', idx: 9 },
          costOutFlow: { alias: 'Cost out flow', idx: 10 },
          costRest: { alias: 'Cost rest', idx: 11 },
          costRestInFlow: { alias: 'Cost rest in flow', idx: 12 },
          pnlTotal: { alias: 'PnL total', idx: 13 },
          pnlRest: { alias: 'PnL rest', idx: 14 },
          update: {
            alias: 'Update',
            idx: 15,
            type: 'date',
            default: new Date(),
          },
        },
      },
      flow: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 1 },
          constractor: { alias: 'Contractor', idx: 2 },
          contractorKey: { alias: 'Contractor key', idx: 3 },
          project: { alias: 'Project', idx: 4 },
          projectKey: { alias: 'Project key', idx: 5 },
          symbol: { alias: 'Symbol', idx: 6 },
          symbolKey: { alias: 'Symbol key', idx: 7 },
          quantityInFlow: { alias: 'Quantity in flow', idx: 8 },
          quantityOutFlow: { alias: 'Quantity out flow', idx: 10 },
          quantityRest: { alias: 'Quantity rest', idx: 11 },
          quantityLock: { alias: 'Quantity rest', idx: 12 },
          quantityUnlock: { alias: 'Quantity rest', idx: 13 },
          priceInFlow: { alias: 'Price in flow', idx: 14 },
          priceOutFlow: { alias: 'Price out flow', idx: 15 },
          priceRest: { alias: 'Price rest', idx: 16 },
          costInFlow: { alias: 'Cost in flow', idx: 17 },
          costOutFlow: { alias: 'Cost out flow', idx: 18 },
          costRestInFlow: { alias: 'Cost rest in flow', idx: 19 },
          costRest: { alias: 'Cost rest', idx: 20 },
          costLock: { alias: 'Cost lock', idx: 21 },
          costUnlock: { alias: 'Cost unlock', idx: 22 },
          pnlRest: { alias: 'PnL rest', idx: 23 },
          pnlTotal: { alias: 'PnL total', idx: 24 },
          update: {
            alias: 'Update',
            idx: 25,
            type: 'date',
            default: new Date(),
          },
        },
      },
      historicalPrices: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          yyyymmdd: { alias: 'YYYYMMDD', pk: true, idx: 1, notNull: true },
          source: { alias: 'Source', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 3, notNull: true },
          priceAvg: { alias: 'Avarage price', idx: 4 },
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
      symbolType: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          strategy: { alias: 'Strategy', idx: 2, notNull: true },
        },
      },

      strategy: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          distribution: { alias: 'Distribution', idx: 2, notNull: true },
        },
      },
      services: {
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
      project: {
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
        },
      },
      accounts: {
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
          account: { alias: 'Account', idx: 1 },
          project: { alias: 'Project', idx: 2 },
          mainSymbol: { alias: 'Main symbol', pk: true, idx: 3, notNull: true },
          mainSymbolQty: {
            alias: 'Main symbol qty',
            pk: true,
            idx: 4,
            notNull: true,
          },
          mainSymbolHistoricalCost: {
            alias: 'Main symbol historical cost',
            pk: true,
            idx: 5,
            notNull: true,
          },
          pairOneSymbol: { alias: 'Pair one symbol', idx: 6 },
          pairOneQty: { alias: 'Pair one qty', idx: 7 },
          pairOnePrice: { alias: 'Pair one price', idx: 8 },
          pairTwoSymbol: { alias: 'Pair one symbol', idx: 9 },
          pairTwoQty: { alias: 'Pair two qty', idx: 10 },
          pairTwoPrice: { alias: 'Pair two price', idx: 1 },
        },
      },
      log: {
        type: 'tx',
        rowNum: 1,
        columns: {
          dateTime: { alias: 'Date and time', idx: 0, type: 'date' },
          method: { alias: 'Method', idx: 1 },
          type: { alias: 'Type', idx: 2 },
          name: { alias: 'Name', idx: 3 },
          message: { alias: 'Message', idx: 4 },
          stack: { alias: 'Stack', idx: 5 },
        },
      },
    };
    this.spreadSheetName = 'portfolio';
  }

  getWorkSheet(sheetName) {
    let headSheetName = sheetName;
    if (sheetName.match('Registry')) {
      headSheetName = 'Registry';
    }
    const head = new Header().getHead(this.workSheetHeads, headSheetName);
    return new WorkSheet(this.spreadSheetName, sheetName, head)
  }

  updateOnEdit(range) {
    let sheetName, headSheetName;
    sheetName = range.getSheet().getSheetName();
    headSheetName = sheetName;
    if (sheetName.match('Registry')) {
      headSheetName = 'Registry';
    }
    const head = new Header().getHead(this.workSheetHeads, headSheetName);
    const workSheet = new WorkSheetRange(
      this.spreadSheetName,
      sheetName,
      head,
      range
    );
    return workSheet
  }
}

class Log {
  constructor() {
    if (Log.exists) {
      return Log.instance
    }
    Log.instance = this;
    Log.exists = true;
    this.workSheet = new Portfolio().getWorkSheet('Log');
  }
  /**
   * Добавление ошибки в реестр ошибок
   * @param {string} method Название метода
   * @param {string} error Текст ошибки
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
      Browser.msgBox('New error!');
      resolve();
    }).then(() => {
      this.truncateLog();
    });
  }
  /**
   * Добавление ошибки в реестр ошибок
   * @param {string} name Название метода
   * @param {string} error Текст ошибки
   */
  addMessage(method, name, message) {
    new Promise((resolve) => {
      const messageString =
        typeof message !== 'string' ? JSON.stringify(message) : message;
      this.workSheet.insertRow({
        dateTime: new FormatDate().getFormatDate('yyyy-MM-dd HH:mm:ss'),
        method: method,
        type: 'message',
        name: name,
        message: messageString,
        stack: void 0,
      });
      resolve();
    }).then(() => {
      this.truncateLog();
    });
  }

  truncateLog() {
    if (this.workSheet.countRow > 25) {
      this.workSheet.deleteRow(2, 20);
    }
  }
}

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
class Instance$1 {
  /**
   * Create new inctance API CryptoCompare
   *
   */
  constructor() {
    if (Instance$1.exists) {
      return Instance$1.instance
    }
    Instance$1.instance = this;
    Instance$1.exists = true;
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
class Price$1 {
  constructor() {
    this.methods = new Instance$1().methods;
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
class CoinsList$1 {
  constructor() {
    this.methods = new Instance$1().methods;
  }
  getCoinsList() {
    return this.methods.get({ endPoint: '/all/coinlist' })?.Data
  }
}

class TopList {
  constructor() {
    this.methods = new Instance$1().methods;
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

class Prices {
  constructor(workSheet = '') {
    if (Prices.exists) {
      return Prices.instance
    }
    Prices.instance = this;
    Prices.exists = true;
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Prices');
  }

  updateId() {
    try {
      // const coins = new Portfolio().getWorkSheet('coins').arrayOfObject
      const coins = new Portfolio().getWorkSheet('coins').object;

      this.workSheet.arrayOfObject.forEach((object) => {
        const coinsKey = new Hash(object.source + object.name + object.symbol)
          .md5;
        // const coin = coins.filter((row) => {
        //   return (
        //     new RegExp(object.name.toString().toLowerCase(), 'g').test(
        //       row.name.toString().toLowerCase()
        //     ) &&
        //     new Hash(object.source).md5 === new Hash(row.source).md5 &&
        //     new Hash(object.symbol).md5 === new Hash(row.symbol).md5
        //   )
        // })[0]
        object.id = coins[coinsKey]?.id || void 0;
        if (
          new Hash(object.source).md5 === new Hash('cryptoCompare'.md5) &&
          !object.price
        ) {
          object.price = new Price$1().getSinglePrice(
            coins[coinsKey]?.id
          );
        }
        // this.workSheet.updateRow(object)
        this.workSheet.insertValue(
          object.id,
          object.rowNum,
          this.workSheet.head.id.idx + 1
        );
      });

      // this.workSheet.arrayOfObject.forEach((object) => {
      //   // new Log().addMessage('Prices.updateId', 'object', object)
      //   this.workSheet.updateRow(object)
      // })
    } catch (error) {
      new Log().addError('Prices.updateId', error);
    }
  }

  updateRisk(symbol, marketCapRank = 0) {
    try {
      const price = this.workSheet.object[new Hash(symbol).md5];
      const symbolType = this.symbolType[new Hash(price?.symbolType).md5];
      if (symbolType?.name !== 'MarketCap') {
        price.riskCategory =
          symbolType?.strategy +
          ' (' +
          this.strategy[new Hash(symbolType?.strategy).md5]?.distribution *
            100 +
          '%)';
      } else {
        if (marketCapRank <= 100) {
          price.riskCategory =
            'Top 100 (' +
            this.strategy[new Hash('Top 100').md5]?.distribution * 100 +
            '%)';
        } else if (marketCapRank > 100 && marketCapRank <= 500) {
          price.riskCategory =
            'Top 500 (' +
            this.strategy[new Hash('Top 500').md5]?.distribution * 100 +
            '%)';
        } else if (marketCapRank > 500 && marketCapRank <= 1000) {
          price.riskCategory =
            'Top 1000 (' +
            this.strategy[new Hash('Top 1000').md5]?.distribution * 100 +
            '%)';
        } else if (marketCapRank > 1000 || !marketCapRank) {
          price.riskCategory =
            'Other (' +
            this.strategy[new Hash('Other').md5]?.distribution * 100 +
            '%)';
        }
      }
    } catch (error) {
      new Log().addError('Prices.updateRisk', error);
    }
  }

  updatePrice(symbol, price) {
    try {
      if (price) {
        this.workSheet.object[new Hash(symbol).md5].price = price;
      } else {
        this.workSheet.object[new Hash(symbol).md5].price = void 0;
      }
      this.workSheet.object[new Hash(symbol).md5].update = new Date();
    } catch (error) {
      new Log().addError('Prices.updatePrice', error);
    }
  }

  updatePrices() {
    try {
      new Promise((resolve) => {
        this.symbolType = new Portfolio().getWorkSheet('symbolType').object;
        this.strategy = new Portfolio().getWorkSheet('strategy').object;
        const listId = Object.fromEntries(
          Object.entries(
            this.workSheet.arrayOfObject.reduce((list, object) => {
              if (!list[object.source]) {
                list[object.source] = [];
              }
              if (object.id && object.source !== 'custom') {
                list[object.source].push(object.id);
              } else {
                list[object.source].push(object.symbol);
              }
              return list
            }, {})
          ).map(([source, idArray]) => [
            source,
            source !== 'custom' ? idArray.join(',') : idArray,
          ])
        );

        // if (listId.cryptorank) {
        //   new cryptoRank.Price().getLastPrice(listId.cryptorank).forEach((coin) => {
        //     updatePrice(coin.symbol, coin.values.USD.price)
        //     updateRisk(coin.symbol, coin.rank)
        //   })
        // }

        if (listId.coingecko) {
          const priceArray = new Price().getMarketsPrice(
            listId.coingecko
          );
          if (priceArray.length) {
            priceArray.forEach((coin) => {
              this.updatePrice(coin.symbol, coin.current_price);
              this.updateRisk(coin.symbol, coin.market_cap_rank);
            });
          }
        }

        // if (listId.coinmarketcap) {
        //   Object.values(
        //     new coinMarketCap.Price().getLastPrice(listId.coinmarketcap)
        //   ).forEach((coin) => {
        //     updatePrice(coin.symbol, coin.quote.USD.price)
        //     updateRisk(coin.symbol, coin.cmc_rank)
        //   })
        // }

        if (listId.cryptocompare) {
          const priceArray = new Price$1().getMultiPrice(
            listId.cryptocompare
          );
          if (priceArray.length) {
            const topMarketCap = new TopList().topMarketCap(1000);
            priceArray.forEach((coin) => {
              this.updatePrice(coin.symbol, coin.price);
              const key = new Hash(coin.symbol).md5;
              const rank = topMarketCap[key]?.rank || 1000;
              this.updateRisk(coin.symbol, rank);
            });
          }
        }

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
        resolve();
      }).then(this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject));
    } catch (error) {
      new Log().addError('Prices.updatePrices', error);
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
    this.duplicatesRow = [];
    this.prices = new Prices().workSheet.object;
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
          arrayOfObject.forEach((tx) => {
            const rowArray = this.workSheet.arrayOfObject.filter(
              (row) => row.rowKey === tx.rowKey
            );
            if (rowArray.length === 1) {
              const oldRow = this.workSheet.object[tx.rowKey];
              tx.rowNum = oldRow.rowNum;
              this.workSheet.updateRow(tx);
            } else if (rowArray.length > 1) {
              rowArray.forEach((row, indexRow) => {
                if (!indexRow) {
                  tx.rowNum = row.rowNum;
                  this.workSheet.updateRow(tx);
                } else {
                  this.duplicatesRow.push(row);
                }
              });
            } else {
              this.workSheet.insertRow(tx);
            }
          });
          resolve();
        }).then(() => {
          this.workSheet.deleteRows(this.duplicatesRow);
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
      new Log().addError('Transactions.updateTransactions', error);
    }
  }

  deleteDuplicatesRows() {
    const newArrayOfObject = Object.values(this.workSheet.object);
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }

  /**
   * Получение средневзвешенной цены покупки токена
   * @param {string} account
   * @param {*} project
   * @param {*} dateTime
   * @param {*} symbol
   * @param {*} convert
   *    @param {*} isRange
   * @returns
   */
  getHistoricalPriceBuy(
    account,
    project,
    dateTime,
    symbol,
    isRange = false,
    convert = 'usd'
  ) {
    try {
      let historicalPrice = void 0;
      let isHistoricalAveragePrice;
      isHistoricalAveragePrice = false;
      const coin = this.prices[new Hash(symbol).md5];
      const sourceKey = new Hash(coin.source).md5;
      const id = coin.id;
      const symbolTypeKey = new Hash(coin.symbolType).md5;
      if (
        ['stablecoin']
          .map((m) => (m = new Hash(m).md5))
          .indexOf(symbolTypeKey) === -1
      ) {
        //* Расчет средневзвешенной стоимости покупки токена на основании истории покупок
        if (isRange) {
          const historicalPriceAgg = this.workSheet.arrayOfObject
            .filter((row) => {
              return (
                new FormatDate(row.dateTime).value <=
                  new FormatDate(dateTime).value &&
                new Hash(account + project + symbol + 'buy' + 'in').md5 ===
                  new Hash(
                    row.account +
                      row.project +
                      row.symbol +
                      row.operation +
                      row.direction
                  ).md5 &&
                row.isBuyPrice
              )
            })
            .reduce((agg, tx) => {
              if (!agg[tx.account]) {
                agg[tx.account] = {};
              }
              if (!agg[tx.account][tx.project]) {
                agg[tx.account][tx.project] = {};
              }
              if (!agg[tx.account][tx.project][tx.symbol]) {
                agg[tx.account][tx.project][tx.symbol] = {
                  quantity: 0,
                  cost: 0,
                };
              }
              agg[tx.account][tx.project][tx.symbol].quantity += tx.quantity;
              agg[tx.account][tx.project][tx.symbol].cost +=
                tx.quantity * tx.price;
              return agg
            }, {});

          //* Расчет средней цены покупки токена
          Object.values(historicalPriceAgg).forEach((level0) => {
            Object.values(level0).forEach((level1) => {
              Object.values(level1).forEach((object) => {
                historicalPrice = object.cost / object.quantity || void 0;
                isHistoricalAveragePrice = true;
              });
            });
          });
        }

        if (historicalPrice) {
          return { historicalPrice, isHistoricalAveragePrice }
        } else {
          if (
            new FormatDate(dateTime).yyyymmdd === new FormatDate().yyyymmdd &&
            sourceKey === new Hash('coingecko').md5
          ) {
            //* Получение исторической цены из coinGecko
            historicalPrice = new coinGecko.Price()
              .getMarketsPrice(id)
              .reduce((price, data) => {
                price = data.current_price;
                return price
              }, 0);
          } else {
            //* Получение исторической цены из CryptoCompare
            if (sourceKey === new Hash('cryptocompare').md5) {
              historicalPrice = new Price$1().getHistoryPrice(
                id,
                dateTime,
                convert
              );
            }
          }
          return { historicalPrice, isHistoricalAveragePrice }
        }
      } else {
        // Для стабильных токенов возвращать единицу
        historicalPrice = 1;
        return { historicalPrice, isHistoricalAveragePrice }
      }
    } catch (error) {
      new Log().addError('Transactions.getHistoricalPriceBuy', error);
    }
  }
}

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName());
  }

  updateTransactions(isRange = false) {
    try {
      const transactions = new Transactions();
      const transactionsArrayOfObject = [];
      const updateDate = new Date();
      const services = new Portfolio().getWorkSheet('services').object;
      this.workSheet.arrayOfObject.forEach((rowValues) => {
        let coinQty,
          currencyQty,
          currencyPerCoin,
          coinSymbol,
          symbolPrice,
          project,
          accountRecipient,
          recipient,
          currencySymbol,
          currencyPrice,
          feePrice,
          mainSymbol,
          isLiquidityPool,
          isFee,
          isLock,
          isBuyPrice,
          isSymbolPrice,
          isCurencyPrice,
          isFeePrice,
          isHistoricalAveragePrice,
          isHistoricalAveragePriceSymbol,
          isHistoricalAveragePriceFeeCurrency,
          isHistoricalAveragePriceCurrency;

        const transactionRow = [];
        const hhmm = new FormatNumber(
          rowValues.time
        ).getHourAndMinuteFromNumber();
        const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
          .date;
        accountRecipient = rowValues.accountRecipient
          ? rowValues.accountRecipient
          : rowValues.accountSender;
        recipient = rowValues.recipient ? rowValues.recipient : rowValues.sender;
        project = rowValues.project ? rowValues.project : 'No project';
        coinQty = rowValues.coinQty || void 0;
        currencyQty = rowValues.currencyQty || void 0;
        currencyPerCoin = rowValues.currencyPerCoin || void 0;
        coinSymbol = rowValues.coin;
        currencySymbol = rowValues.currency;
        isLiquidityPool = false;
        isFee = false;
        isBuyPrice = false;
        isLock = false;
        isSymbolPrice = false;
        isCurencyPrice = false;
        isFeePrice = false;
        isHistoricalAveragePriceSymbol = false;
        isHistoricalAveragePriceFeeCurrency = false;
        isHistoricalAveragePriceCurrency = false;

        if (!currencyPerCoin && currencyQty) {
          currencyPerCoin = currencyQty / coinQty;
        }
        if (!currencyQty && currencyPerCoin) {
          currencyQty = coinQty * currencyPerCoin;
        }
        if (!coinQty) {
          coinQty = currencyQty / currencyPerCoin;
        }
        //* расчет пулов ликвидности
        if (
          ['Liquidity pool (1)', 'Liquidity pool (2)']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.service).md5) !== -1
        ) {
          coinQty /= 2;
          mainSymbol = coinSymbol;
          isLiquidityPool = true;
        }
        if (
          ['Transfer', 'Write-off', 'Refill']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          currencyPerCoin = 1;
          currencySymbol = coinSymbol;
          if (
            ['Transfer', 'Write-off']
              .map((m) => (m = new Hash(m).md5))
              .indexOf(new Hash(rowValues.operation).md5) !== -1
          ) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#1').md5,
              direction: 'out',
              account: rowValues.accountSender,
              contractor: rowValues.sender,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty * -1,
              isFee,
              isLock,
              isLiquidityPool,
              isBuyPrice,
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
            });
          }
          if (
            ['Transfer', 'Refill']
              .map((m) => (m = new Hash(m).md5))
              .indexOf(new Hash(rowValues.operation).md5) !== -1
          ) {
            transactionRow.push({
              rowKey: new Hash(rowValues.rowKey + '#2').md5,
              direction: 'in',
              account: accountRecipient,
              contractor: recipient,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty,
              isFee,
              isLock: rowValues.isLock,
              isLiquidityPool,
              isBuyPrice,
              isSymbolPrice: true,
              isFeePrice,

              isCurencyPrice,
            });
          }
        } else if (
          ['Buy']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty * -1,
            isFee,
            isLock,
            isLiquidityPool,
            isBuyPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          });
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            contractor: recipient,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty,
            isFee,
            isLock,
            isLiquidityPool,
            isBuyPrice: true,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          });
        } else if (
          ['Sell']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty * -1,
            isFee,
            isLock,
            isLiquidityPool,
            isBuyPrice,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          });
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty,
            isFee,
            isLock,
            isLiquidityPool,
            isBuyPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          });
        }

        //* Комиссия
        if (rowValues.feeCurrency) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#3').md5,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainSymbol: void 0,
            symbol: rowValues.feeCurrency,
            quantity: rowValues.feeQty * -1,
            isFee: true,
            isLock,
            isLiquidityPool,
            isBuyPrice,
            isFeePrice: true,
            isSymbolPrice,
            isCurencyPrice,
          });
          const historicalPriceBuy = transactions.getHistoricalPriceBuy(
            rowValues.accountSender,
            project,
            dateTime,
            rowValues.feeCurrency,
            isRange
          );
          feePrice = historicalPriceBuy.historicalPrice;
          isHistoricalAveragePriceFeeCurrency =
            historicalPriceBuy.isHistoricalAveragePrice;
        }

        //* Расчет текущей или исторической цены покупаемого токена
        if (
          ['Buy', 'Sell', 'Refill', 'Write-off', 'Transfer']
            .map((m) => (m = new Hash(m).md5))
            .indexOf(new Hash(rowValues.operation).md5) !== -1
        ) {
          const historicalPriceBuy = transactions.getHistoricalPriceBuy(
            rowValues.accountSender,
            project,
            dateTime,
            currencySymbol,
            isRange
          );
          isHistoricalAveragePriceCurrency =
            historicalPriceBuy.isHistoricalAveragePrice;
          currencyPrice = historicalPriceBuy.historicalPrice;
          isHistoricalAveragePriceSymbol =
            historicalPriceBuy.isHistoricalAveragePrice;
          symbolPrice = currencyPrice * currencyPerCoin;
        }

        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          let price;
          if (tx.isSymbolPrice) {
            price = symbolPrice;
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency;
          } else if (tx.isFeePrice) {
            price = feePrice;
            isHistoricalAveragePrice = isHistoricalAveragePriceFeeCurrency;
          } else if (tx.isCurencyPrice) {
            price = currencyPrice;
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency;
          }
          const cost = tx.quantity * price;
          const object = {
            rowKey: tx.rowKey,
            sourceKey: new Hash(this.workSheet.sheetName).md5,
            sourceName: new Hash(this.workSheet.sheetName).stringLowerCase,
            dateTime: dateTime,
            direction: tx.isFee ? 'out' : tx.direction.toLowerCase(),
            operation: tx.isFee
              ? 'write-off'
              : rowValues.operation.toLowerCase(),
            account: tx.account.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            project: tx.project.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            mainSymbol: tx.mainSymbol ? tx.mainSymbol.toLowerCase() : void 0,
            symbol: tx.symbol.toLowerCase(),
            quantity: tx.quantity,
            price: price || 0,
            cost: cost || 0,
            comment: rowValues.comment.toString().toLowerCase(),
            registryRowNum: rowValues.rowNum,
            updateDate: updateDate,
            isDelete: rowValues.isDelete,
            isBuyPrice: tx.isBuyPrice,
            isLiquidityPool: tx.isLiquidityPool,
            isFee: tx.isFee,
            isLock: tx.isLock,
            isHistoricalAveragePrice,
          };
          transactionsArrayOfObject.push(object);
        });
      });

      if (transactionsArrayOfObject.length) {
        transactions.updateTransactions(
          transactionsArrayOfObject,
          this.workSheet.isRange
        );
      }

      this.workSheet.deleteEmptyRows();
    } catch (error) {
      new Log().addError('Registry.updateTransactions', error);
    }
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
    // new cryptoRank.CoinsList().getCoinsList(15000).forEach((coin) => {
    //   const key = new Hash('cryptorank' + coin.name + coin.symbol)
    //   coins.push({
    //     rowKey: key.md5,
    //     source: 'cryptorank',
    //     name: coin.name,
    //     symbol: coin.symbol,
    //     id: coin.id,
    //   })
    // })
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

    Object.entries(new CoinsList$1().getCoinsList()).forEach(
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
    this.workSheet.truncateInsertRows(coins);
  }
}

class LPToken {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('LPToken');
  }

  updateLPToken() {
    // const prices = new Portfolio().getWorkSheet('prices').object
    const transactionsLpToken = new Portfolio()
      .getWorkSheet('transactions')
      .arrayOfObject.filter(
        (row) =>
          ['liquidity pool (1)', 'liquidity pool (2)'].indexOf(row.service) !==
            -1 && row.operation === 'buy'
      );
    const aggBalance = transactionsLpToken.reduce((object, tx) => {
      const positiveQuantity = tx.quantity < 0 ? tx.quantity * -1 : tx.quantity;
      if (!object[tx.account]) {
        object[tx.account] = {};
      }
      if (!object[tx.account][tx.project]) {
        object[tx.account][tx.project] = {};
      }
      if (!object[tx.account][tx.project][tx.mainCoin]) {
        object[tx.account][tx.project][tx.mainCoin] = [];
      }
      let part;
      if (tx.mainCoin === tx.coin) {
        part = 'main';
      } else {
        if (tx.service === 'liquidity pool (1)') {
          part = 'one';
        } else {
          part = 'two';
        }
      }
      object[tx.account][tx.project][tx.mainCoin].push({
        quantity: positiveQuantity,
        cost: tx.mainCoin === tx.coin ? positiveQuantity * tx.price : 0,
        part: part,
        coin: tx.coin,
      });

      return object
    }, {});
    const newArrayOfObject = [];
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([project, level1]) => {
        Object.entries(level1).forEach(([mainCoin, level2]) => {
          const aggMainCoin = level2.reduce((object, tx) => {
            if (!object[tx.part]) {
              object[tx.part] = {
                quantity: 0,
                cost: 0,
                coin: tx.coin,
              };
            }
            object[tx.part].quantity += tx.quantity;
            object[tx.part].cost += tx.cost;
            return object
          }, {});

          newArrayOfObject.push({
            account: account.toUpperCase(),
            project: project.toUpperCase(),
            mainCoin: mainCoin.toUpperCase(),
            mainCoinQty: aggMainCoin.main.quantity,
            mainCoinHistoricalCost: aggMainCoin.main.cost,
            pairOneCoin: aggMainCoin.one.coin,
            pairOneQty: aggMainCoin.one.quantity,
            pairOnePrice: aggMainCoin.main.cost / 2 / aggMainCoin.one.quantity,
            pairTwoCoin: aggMainCoin.two.coin,
            pairTwoQty: aggMainCoin.two.quantity,
            pairTwoPrice: aggMainCoin.main.cost / 2 / aggMainCoin.two.quantity,
          });
        });
      });
    });
    // console.log(newArrayOfObject)
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }
}

class FlowSymbol {
  constructor(workSheet = '') {
    if (FlowSymbol.exists) {
      return Flow.instance
    }
    FlowSymbol.instance = this;
    FlowSymbol.exists = true;
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('FlowSymbol');
  }

  updateFlow() {
    try {
      const prices = new Portfolio().getWorkSheet('prices').object;
      const services = new Portfolio().getWorkSheet('services').object;
      const aggFlow = new Portfolio()
        .getWorkSheet('Transactions')
        .arrayOfObject.filter((row) => !row.isDelete)
        .reduce((agg, tx) => {
          if (!agg[tx.account]) {
            agg[tx.account] = {};
          }

          if (!agg[tx.account][tx.symbol]) {
            agg[tx.account][tx.symbol] = {
              quantityBuyIn: 0,
              quantityBuyOut: 0,
              quantitySellIn: 0,
              quantitySellOut: 0,
              quantityRefillIn: 0,
              quantityWriteOffOut: 0,
              quantityTransferIn: 0,
              quantityTransferOut: 0,
              quantityRest: 0,
              costBuyIn: 0,
              costBuyOut: 0,
              costSellIn: 0,
              costSellOut: 0,
              costRefillIn: 0,
              costWriteOffOut: 0,
              costTransferIn: 0,
              costTransferOut: 0,
            };
          }
          //* Распределение количества по потокам

          if (new Hash(tx.operation).md5 === new Hash('buy').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.symbol].quantityBuyIn += tx.quantity;
              agg[tx.account][tx.symbol].costBuyIn += tx.cost;
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.symbol].quantityBuyOut += tx.quantity * -1;
              agg[tx.account][tx.symbol].costBuyOut += tx.cost * -1;
            }
          } else if (new Hash(tx.operation).md5 === new Hash('sell').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.symbol].quantitySellIn += tx.quantity;
              agg[tx.account][tx.symbol].costSellIn += tx.cost;
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.symbol].quantitySellOut += tx.quantity * -1;
              agg[tx.account][tx.symbol].costSellOut += tx.cost * -1;
            }
          } else if (new Hash(tx.operation).md5 === new Hash('refill').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.symbol].quantityRefillIn += tx.quantity;
              agg[tx.account][tx.symbol].costRefillIn += tx.cost;
            }
          } else if (new Hash(tx.operation).md5 === new Hash('write-off').md5) {
            if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.symbol].quantityWriteOffOut += tx.quantity * -1;
              agg[tx.account][tx.symbol].costWriteOffOut += tx.cost * -1;
            }
          } else if (new Hash(tx.operation).md5 === new Hash('transfer').md5) {
            if (new Hash(tx.direction).md5 === new Hash('in').md5) {
              agg[tx.account][tx.symbol].quantityTransferIn += tx.quantity;
              agg[tx.account][tx.symbol].costTransferIn += tx.cost;
            } else if (new Hash(tx.direction).md5 === new Hash('out').md5) {
              agg[tx.account][tx.symbol].quantityTransferOut += tx.quantity * -1;
              agg[tx.account][tx.symbol].costTransferOut += tx.cost * -1;
            }
          }
          agg[tx.account][tx.symbol].quantityRest += tx.quantity;

          return agg
        }, {});
      const aggFlowArrayOfObject = [];
      Object.entries(aggFlow).forEach(([account, level0]) => {
        Object.entries(level0).forEach(([symbol, object]) => {
          //* доп. атрибуты
          const symbolKey = new Hash(symbol).md5;
          const priceRest = prices[symbolKey]?.price;
          const costRest = prices[symbolKey]?.price * object.quantityRest;

          //* расчет потоков без перемещений. т.к. между токенами нет перемещений
          const costInFlow =
            object.costBuyIn + object.costSellIn + object.costRefillIn;

          const costOutFlow =
            object.costBuyOut + object.costSellOut + object.costWriteOffOut;

          const quantityInFlow =
            object.quantityBuyIn +
            object.quantitySellIn +
            object.quantityRefillIn;

          const quantityOutFlow =
            object.quantityBuyOut +
            object.quantitySellOut +
            object.quantityWriteOffOut;

          //* расчет цены

          const priceInFlow = costInFlow / quantityInFlow;
          const priceOutFlow = costOutFlow / quantityOutFlow;

          aggFlowArrayOfObject.push({
            account: account.toUpperCase(),
            symbol: symbol.toUpperCase(),
            symbolKey: symbolKey,
            // quantityBuyIn: object.quantityBuyIn || 0,
            // quantityBuyOut: object.quantityBuyOut || 0,
            // quantitySellIn: object.quantitySellIn || 0,
            // quantitySellOut: object.quantitySellOut || 0,
            // quantityRefillIn: object.quantityRefillIn || 0,
            // quantityWriteOffOut: object.quantityWriteOffOut || 0,
            // quantityTransferIn: object.quantityTransferIn || 0,
            // quantityTransferOut: object.quantityTransferOut || 0,
            quantityInFlow: quantityInFlow || 0,
            quantityOutFlow: quantityOutFlow || 0,
            quantityRest: object.quantityRest || 0,
            // priceBuy: priceBuy || 0,
            // priceSell: priceSell || 0,
            // priceRefill: priceRefill || 0,
            // priceWriteOff: priceWriteOff || 0,
            // priceTransferIn: priceTransferIn || 0,
            // priceTransferOut: priceTransferOut || 0,
            priceInFlow: priceInFlow || 0,
            priceOutFlow: priceOutFlow || 0,
            priceRest: priceRest || 0,
            // costBuyIn: object.costBuyIn || 0,
            // costBuyOut: object.costBuyOut || 0,
            // costSellIn: object.costSellIn || 0,
            // costSellOut: object.costSellOut || 0,
            // costRefillIn: object.costRefillIn || 0,
            // costWriteOffOut: object.costWriteOffOut || 0,
            // costTransferIn: object.costTransferIn || 0,
            // costTransferOut: object.costTransferOut || 0,
            costInFlow: costInFlow || 0,
            costOutFlow: costOutFlow || 0,
            costRest: costRest || 0,
            costRestInFlow: priceInFlow * object.quantityRest || 0,
            pnlTotal: costOutFlow - costInFlow + costRest || 0,
            pnlRest: costRest - priceInFlow * object.quantityRest || 0,
          });
        });
      });

      this.workSheet.truncateInsertRows(aggFlowArrayOfObject);
    } catch (error) {
      new Log().addError('FlowSymbol.updateFlow', error);
    }
  }
}

// import { GasProcess } from '../restApi/gasScriptApi'

function updateLPToken() {
  new LPToken().updateLPToken();
}

function updateTransactions() {
  const startProcess = new FormatDate();
  try {
    new Registry().updateTransactions();
  } catch (error) {
    new Log().addError('updateTransactions', error);
  } finally {
    new Log().addMessage(
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
    new Log().addError('deleteDuplicatesRows', error);
  } finally {
    new Log().addMessage(
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
    new Log().addError('updateCoins', error);
  } finally {
    new Log().addMessage(
      'updateCoins',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    );
  }
}

function updateFlow() {
  const startProcess = new FormatDate();
  try {
    new FlowSymbol().updateFlow();
    // new Flow().updateFlow()
  } catch (error) {
    new Log().addError('updateFlow', error);
  } finally {
    new Log().addMessage(
      'updateFlow',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    );
  }
}

function updatePrices() {
  const startProcess = new FormatDate();
  try {
    new Promise((resolve) => {
      new Prices().updatePrices();
      resolve();
    }).then(() => {
      new FlowSymbol().updateFlow();
      // new Flow().updateFlow()
    });
  } catch (error) {
    new Log().addError('updatePrices', error);
  } finally {
    new Log().addMessage(
      'updatePrices',
      'ID:' + startProcess.value,
      'Time spent: ' + startProcess.getTimeDiff()
    );
  }
}

function updateOnEdit(editRange) {
  const startProcess = new FormatDate();
  let countRowInRange,
    sheetNameInRange,
    rowStartInRange,
    rowEndInRange,
    isRegistry;
  isRegistry = false;
  sheetNameInRange = editRange.range.getSheet().getName();
  countRowInRange = editRange.range.rowEnd - editRange.range.rowStart + 1;
  countColumnInRange =
    editRange.range.columnEnd - editRange.range.columnStart + 1;
  rowStartInRange = editRange.range.rowStart;
  rowEndInRange = editRange.range.rowEnd;
  new Promise((resolve, reject) => {
    const update = () => {
      const workSheet = new Portfolio().updateOnEdit(editRange.range);
      if (workSheet.isNotNull) {
        if (workSheet.isChangePrimaryKey) {
          workSheet.savePrimaryKeyChanges();
        }
        if (new Hash(workSheet.sheetName).md5 === new Hash('prices').md5) {
          new Prices(workSheet).updateId();
        } else if (workSheet.sheetName.match(new RegExp('[Registry]+', 'g'))) {
          new Promise((resolve) => {
            SpreadsheetApp.getActive().toast(
              'Save registry starting',
              'Save process',
              1
            );
            resolve();
          }).then(() => {
            new Registry(workSheet).updateTransactions(true);
            isRegistry = true;
          });
        }
      }
      return true
    };
    update() ? resolve(isRegistry) : reject();
  })
    .then((isRegistry) => {
      new Log().addMessage(
        'updateOnEdit',
        'ID:' + startProcess.value,
        'Sheet name: ' +
          sheetNameInRange +
          ', Start row: ' +
          rowStartInRange +
          ', End Row: ' +
          rowEndInRange +
          ', Count row: ' +
          countRowInRange +
          ', Time spent: ' +
          startProcess.getTimeDiff()
      );
      if (isRegistry) {
        SpreadsheetApp.getActive().toast(
          'Save process ended',
          'Save process',
          1
        );
      }
    })
    .catch((error) => {
      new Log().addError('updateOnEdit', error);
    });
}

function createMenu() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Portfolio');
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      // .addItem('Update average historical price and balance', 'updateBalance')
      .addItem('Update current prices and flow', 'updatePrices')
      .addItem('Update coins', 'updateCoins')
      .addItem('Update transactions', 'updateTransactions')
      .addItem('Update flow', 'updateFlow')
  );
  menu.addToUi();
}
