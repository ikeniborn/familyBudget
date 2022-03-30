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

Object.prototype.copy = function () {
  if (!Object.keys(this).length) {
    return JSON.parse(JSON.stringify(this))
  }
  return this
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
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow;
        const rowKey = arrayRow[this.head.rowKey.idx];
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = arrayRow.reduce((object, value, index) => {
            object['rowNum'] = rowNum;
            if (!object[this.headKey[index]]) {
              object[this.headKey[index]] = value;
            }
            return object
          }, {});
        }
        return objectRow
      }, {});
    this.arrayOfObject = Object.values(this.object);
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
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow;
        const rowKey = new Hash(rowNum + this.sheetName).md5;
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = arrayRow.reduce((object, value, column) => {
            object['rowKey'] = rowKey;
            object['rowNum'] = rowNum;
            if (!object[this.headKey[column]]) {
              object[this.headKey[column]] = value;
            }
            return object
          }, {});
        }
        return objectRow
      }, {});
    this.arrayOfObject = Object.values(this.object);
    return this
  }

  truncateInsertRows(arrayOfObject = [], firstRow = 1, firstColumn = 1) {
    const array = arrayOfObject.reduce(
      (values, rowObject) => {
        const rowArray = this.headKey.map((value) => rowObject[value]);
        values.push(rowArray);
        return values
      },
      [new Header().getHeaderAlias(this.head)]
    );
    if (array.length) {
      const truncateInsertRowsPromise = () => {
        return new Promise((resolve) => {
          this.deleteFilter();
          resolve();
        }).then(() => {
          return new Promise((resolve) => {
            this.workSheet
              .clear()
              .getRange(firstRow, firstColumn, array.length, array[0].length)
              .setValues(array);
            resolve();
          }).then(() => {
            this.deleteEmptyRows().deleteEmptyColumns();
          })
        })
      };

      truncateInsertRowsPromise();
    }
    return this
  }

  updateRow(object = {}) {
    if (object.rowNum !== this.headerRowNum) {
      const array = [this.headKey.map((column) => object[column])];
      const updateRowPromise = async () => {
        return new Promise((resolve) => {
          this.deleteFilter();
          resolve();
        }).then(async () => {
          return new Promise((resolve) => {
            this.workSheet
              .getRange(object.rowNum, 1, array.length, array[0].length)
              .setValues(array);
            resolve();
          }).then(() => {
            this.deleteEmptyRows().deleteEmptyColumns();
          })
        })
      };
      updateRowPromise();
    }
  }

  insertRow(object = {}) {
    new Promise((resolve) => {
      const array = this.headKey.map((column) => object[column]);
      this.workSheet.appendRow(array);
      resolve();
    }).then(() => {
      this.deleteEmptyRows().deleteEmptyColumns();
    });
  }

  insertValue(value, row, column) {
    this.workSheet.getRange(row, column).setValue(value);
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
    const countEmptyRow = this.maxRow - this.lastRow;
    const firstEmptyRow = this.lastRow + 1;
    if (countEmptyRow) {
      this.workSheet.deleteRows(firstEmptyRow, countEmptyRow);
    }
    return this
  }

  /**
   *  Удаление пустых колонок
   */
  deleteEmptyColumns() {
    const countEmptyRow = this.maxColumn - this.lastColumn;
    const firstEmptyRow = this.lastColumn + 1;
    if (countEmptyRow) {
      this.workSheet.deleteColumns(firstEmptyRow, countEmptyRow);
    }
    return this
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
    this.getDataset();
  }

  getFact() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow;
        const rowKey = arrayRow[this.head.rowKey.idx];
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = arrayRow.reduce((object, value, index) => {
            object['rowNum'] = rowNum;
            if (!object[this.headKey[index]]) {
              object[this.headKey[index]] = value;
            }
            return object
          }, {});
        }
        return objectRow
      }, {});
    this.arrayOfObject = Object.values(this.object);
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
          // object.isChangePrimaryKey = true
          this.isChangePrimaryKey = true;
        }
        if (!objectRow[object.rowKey]) {
          objectRow[object.rowKey] = object;
        }
        // object.isNotNull = new Header().isNotNull(this.head, object)
        this.isNotNull = new Header().isNotNull(this.head, object);
        return objectRow
      }, {});
    this.arrayOfObject = Object.values(this.object);
    return this
  }

  getTransactions() {
    this.object = this.dataRange
      .getValues()
      .reduce((objectRow, arrayRow, indexRow) => {
        const rowNum = this.firstRowNum + indexRow;
        const rowKey = new Hash(rowNum + this.sheetName).md5;
        const object = arrayRow.reduce((object, value, column) => {
          if (!object[this.headKey[column]]) {
            object[this.headKey[column]] = value;
            object['rowKey'] = rowKey;
            object['rowNum'] = rowNum;
          }
          return object
        }, {});
        if (!objectRow[rowKey]) {
          objectRow[rowKey] = object;
          objectRow[rowKey]['rowKey'] = rowKey;
          objectRow[rowKey]['rowNum'] = rowNum;
          this.isNotNull = new Header().isNotNull(this.head, object);
        }
        return objectRow
      }, {});
    this.arrayOfObject = Object.values(this.object);
    return this
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
          coin: { alias: 'Coin', idx: 8, notNull: true },
          coinQty: { alias: 'Coin, qty', idx: 9 },
          currency: { alias: 'Currency', idx: 10 },
          currencyQty: { alias: 'Currency, qty', idx: 11 },
          currencyPerCoin: { alias: 'Currency per coin', idx: 12 },
          feeCurrency: { alias: 'Fee currency', idx: 13 },
          feeQty: { alias: 'Fee, qty', idx: 14 },
          comment: { alias: 'Comment', idx: 15 },
          date: { alias: 'Date', idx: 16, notNull: true },
          time: { alias: 'Time', idx: 17, notNull: true },
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
            alias: 'Name',
            idx: 2,
            notNull: true,
          },
          symbol: {
            alias: 'Symbol',
            pk: true,
            idx: 3,
            notNull: true,
          },
          pairOne: {
            alias: 'Pair one',
            idx: 4,
          },
          pairTwo: {
            alias: 'Pair two',
            idx: 5,
          },
          coinType: {
            alias: 'Coin type',
            idx: 6,
            notNull: true,
          },
          risk: { alias: 'Risk', idx: 7 },
          id: { alias: 'Id', idx: 8 },
          price: { alias: 'Price', idx: 9 },
          update: { alias: 'Update', idx: 10 },
        },
      },
      transactions: {
        type: 'fct',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          dateTime: { alias: 'Date and time', idx: 1 },
          account: { alias: 'Account', idx: 2 },
          platform: { alias: 'Platform', idx: 3 },
          service: { alias: 'Service', idx: 4 },
          project: { alias: 'Project', idx: 5 },
          contractor: { alias: 'Contractor', idx: 6 },
          coin: { alias: 'Coin', idx: 7 },
          quantity: { alias: 'Quantity', idx: 8 },
          price: { alias: 'Price', idx: 9 },
          comment: { alias: 'Comment', idx: 10 },
          registryRowNum: { alias: 'Registry row num', idx: 11 },
          updateDate: { alias: 'Update', idx: 12 },
        },
      },
      balance: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          contractor: { alias: 'Contractor', idx: 1 },
          contractorType: { alias: 'Contractor type', idx: 2 },
          service: { alias: 'Service', idx: 3 },
          project: { alias: 'Project', idx: 4 },
          coin: { alias: 'Coin', idx: 5 },
          coinType: { alias: 'Coin Type', idx: 6 },
          risk: { alias: 'Risk', idx: 7 },
          quantity: { alias: 'Quantity', idx: 8 },
          historicalCostBuy: { alias: 'Historical buy cost', idx: 9 },
          historicalCostAvg: { alias: 'Historical average cost', idx: 10 },
          currentCost: { alias: 'Current cost', idx: 11 },
        },
      },
      historicalPrices: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          account: { alias: 'Account', pk: true, idx: 1 },
          project: { alias: 'Project', pk: true, idx: 2 },
          symbol: { alias: 'Symbol', pk: true, idx: 3 },
          quantity: { alias: 'Quantity', idx: 4 },
          priceAvg: { alias: 'Price avg', idx: 5 },
          priceBuy: { alias: 'Price buy', idx: 6 },
          priceSell: { alias: 'Price sell', idx: 7 },
        },
      },
      coins: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: { alias: 'Source', pk: true, idx: 1 },
          name: { alias: 'Name', pk: true, idx: 2 },
          symbol: { alias: 'Symbol', pk: true, idx: 3 },
          id: { alias: 'Id', idx: 4 },
        },
      },
      sources: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      coinType: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      services: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      operations: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      project: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      accounts: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
        },
      },
      contractors: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1 },
          type: { alias: 'Type', idx: 2 },
          category: { alias: 'Category', idx: 3 },
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
 * CryptoRank instance
 */
class Instance$3 {
  /**
   * Create new inctance API CryptoRank
   */
  constructor() {
    if (Instance$3.exists) {
      return Instance$3.instance
    }
    Instance$3.instance = this;
    Instance$3.exists = true;
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
class Price$3 {
  constructor() {
    this.methods = new Instance$3().methods;
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
    return this.methods.get({
      endPoint: '/price',
      query: {
        fsym: fsym.toUpperCase(),
        tsyms: tsyms,
        relaxedValidation: true,
      },
    })
  }

  getMultiPrice(fsyms = '', tsyms = 'USD') {
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
  }

  getMultiFullPrice(fsyms = '', tsyms = 'USD') {
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
  }

  getHistoryPrice(fsym = 'BTC', ts = new Date(), tsyms = 'USD') {
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
  }
}
/**
 * CryptoCompare coin list
 */
class CoinsList$1 {
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
  topListBy24h(limit = 100, page = 1, tsym = 'usd') {
    const upperTsym = tsym.toUpperCase();
    const arrayOfObject =
      this.methods.get({
        endPoint: '/top/totalvolfull',
        query: {
          tsym: upperTsym,
          limit,
          page,
        },
      })?.Data || [];
    const startPosition = limit * page - (limit - 1);
    return arrayOfObject.reduce((list, object, index) => {
      const key = new Hash(object.CoinInfo.Internal).md5;
      if (!list[key]) {
        list[key] = {};
      }
      list[key]['rank'] = startPosition + index;
      return list
    }, {})
  }
}

/**
 * CoinMarketCap instance
 */
class Instance$1 {
  constructor() {
    if (Instance$1.exists) {
      return Instance$1.instance
    }
    Instance$1.instance = this;
    Instance$1.exists = true;
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
class Price$1 {
  constructor() {
    this.methods = new Instance$1().methods;
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
    const coinsArray = new Portfolio().getWorkSheet('coins').arrayOfObject;
    this.workSheet.arrayOfObject.map((object) => {
      const coinPrice = coinsArray.filter((row) => {
        return (
          new RegExp(object.name.toString().toLowerCase(), 'g').test(
            row.name.toString().toLowerCase()
          ) &&
          new Hash(object.source).md5 === new Hash(row.source).md5 &&
          new Hash(object.symbol).md5 === new Hash(row.symbol).md5
        )
      })[0];
      object.id = coinPrice?.id || '#N/A';
      return object
    });

    this.workSheet.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object);
    });
  }

  getHistoricalPrice(account, project, date, symbol, convert = 'usd') {
    const coin = this.workSheet.object[new Hash(symbol).md5];
    const source = coin.source;
    const id = coin.id;
    const risk = coin.risk;
    if (new Hash('Stablecoin/Fiat').md5 !== new Hash(risk).md5) {
      if (new FormatDate(date).yyyymmdd === new FormatDate().yyyymmdd) {
        if (new Hash(source).md5 === new Hash('cryptorank').md5) {
          return new Price$3()
            .getLastPrice(id)
            .reduce((price, data) => {
              price = data.values.USD.price;
              return price
            }, 0)
        } else if (new Hash(source).md5 === new Hash('cryptocompare').md5) {
          return Object.values(
            new Price$2().getMultiPrice(id)
          ).reduce((price, data) => {
            price = data.USD;
            return price
          }, 0)
        } else if (new Hash(source).md5 === new Hash('coingecko').md5) {
          return new Price()
            .getMarketsPrice(id)
            .reduce((price, data) => {
              price = data.current_price;
              return price
            }, 0)
        } else if (new Hash(source).md5 === new Hash('coinmarketcap').md5) {
          return Object.values(
            new Price$1().getLastPrice(id)
          ).reduce((price, data) => {
            price = data.quote.USD.price;
            return price
          }, 0)
        }
      } else {
        let historicalPrice;
        if (new Hash(source).md5 === new Hash('cryptocompare').md5) {
          historicalPrice = new Price$2().getHistoryPrice(
            id,
            date,
            convert
          );
        }
        if (historicalPrice) {
          return historicalPrice
        } else {
          const histirocalPrices = new Portfolio().getWorkSheet(
            'historicalPrices'
          ).object;
          return (
            histirocalPrices[new Hash(account + project + symbol).md5]
              ?.priceBuy || void 0
          )
        }
      }
    } else {
      return 1
    }
  }

  updatePrices() {
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
    const top100 = new TopList().topListBy24h(100, 1);
    const updateRisk = (symbol, rank = 1000) => {
      const coin = this.workSheet.object[new Hash(symbol).md5];
      if (['Stablecoin', 'Fiat'].indexOf(coin.coinType) !== -1) {
        coin.risk = 'Stablecoin/Fiat';
      } else if (['LP token'].indexOf(coin.coinType) !== -1) {
        coin.risk = 'Very High';
      } else {
        let rank_ = rank;
        if (coin.source === 'custom') {
          rank_ = 1000;
        }
        if (rank_ <= 10) {
          coin.risk = 'Very low';
        } else if (rank_ <= 50) {
          coin.risk = 'Low';
        } else if (rank_ <= 100) {
          coin.risk = 'Middle';
        } else if (rank_ > 100) {
          coin.risk = 'High';
        }
      }
    };

    const updatePrice = (symbol, price) => {
      if (price) {
        this.workSheet.object[new Hash(symbol).md5].price = price;
      } else {
        this.workSheet.object[new Hash(symbol).md5].price = void 0;
      }
      this.workSheet.object[new Hash(symbol).md5].update = new Date();
    };

    // if (listId.cryptorank) {
    //   new cryptoRank.Price().getLastPrice(listId.cryptorank).forEach((coin) => {
    //     updatePrice(coin.symbol, coin.values.USD.price)
    //     updateRisk(coin.symbol, coin.rank)
    //   })
    // }

    if (listId.coingecko) {
      const priceArray = new Price().getMarketsPrice(listId.coingecko);
      if (priceArray.length) {
        priceArray.forEach((coin) => {
          updatePrice(coin.symbol, coin.current_price);
          updateRisk(coin.symbol, coin.market_cap_rank);
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
      const priceArray = new Price$2().getMultiPrice(
        listId.cryptocompare
      );
      if (priceArray.length) {
        priceArray.forEach((coin) => {
          updatePrice(coin.symbol, coin.price);
          const key = new Hash(coin.symbol).md5;
          const rank = top100[key]?.rank || 1000;
          updateRisk(coin.symbol, rank);
        });
      }
    }

    if (listId.custom.length) {
      const histirocalPrices = new Portfolio().getWorkSheet('historicalPrices')
        .object;
      listId.custom.forEach((symbol) => {
        const histirocalPricesKey = new Hash(
          'ikeniborn' + 'no project' + symbol
        ).md5;
        const histirocalPrice =
          histirocalPrices[histirocalPricesKey]?.priceAvg || void 0;
        updatePrice(symbol, histirocalPrice);
        updateRisk(symbol);
      });
    }
    this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject);
  }
}

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName());
  }

  updateTransactions() {
    const arrayOfObject = [];
    const updateDate = new Date();
    const prices = new Prices();
    this.workSheet.arrayOfObject.forEach((rowValues) => {
      let coinQty,
        currencyQty,
        currencyPerCoin,
        coinSymbol,
        coinPrice,
        project,
        accountRecipient,
        recipient,
        currencySymbol;
      const transactionRow = [];
      const hhmm = new FormatNumber(rowValues.time).getHourAndMinuteFromNumber();
      const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
        .date;
      accountRecipient = rowValues.accountRecipient
        ? rowValues.accountRecipient
        : rowValues.accountSender;
      recipient = rowValues.recipient ? rowValues.recipient : rowValues.sender;
      project = rowValues.project ? rowValues.project : 'No project';
      coinQty = rowValues.coinQty;
      currencyQty = rowValues.currencyQty;
      coinSymbol = rowValues.coin;
      currencySymbol = rowValues.currency;

      if (
        ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !== -1
      ) {
        if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#1').md5,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            coin: coinSymbol,
            quantity: coinQty * -1,
          });
        }
        if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            rowKey: new Hash(rowValues.rowKey + '#2').md5,
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            coin: coinSymbol,
            quantity: coinQty,
          });
        }
      } else if (['Buy'].indexOf(rowValues.operation) !== -1) {
        if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
          currencyQty = coinQty * rowValues.currencyPerCoin;
        }
        if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
          coinQty = currencyQty / rowValues.currencyPerCoin;
        }
        if (rowValues.service === 'Liquidity pool') {
          coinQty /= 2;
        }
        if (rowValues.currencyPerCoin) {
          currencyPerCoin = rowValues.currencyPerCoin;
        } else {
          currencyPerCoin = currencyQty / coinQty;
        }
        transactionRow.push({
          rowKey: new Hash(rowValues.rowKey + '#1').md5,
          account: rowValues.accountSender,
          contractor: rowValues.sender,
          project: 'No project',
          coin: currencySymbol,
          quantity: currencyQty * -1,
        });
        transactionRow.push({
          rowKey: new Hash(rowValues.rowKey + '#2').md5,
          account: accountRecipient,
          contractor: recipient,
          project: project,
          coin: coinSymbol,
          quantity: coinQty,
        });
      } else if (['Sell'].indexOf(rowValues.operation) !== -1) {
        if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
          currencyQty = coinQty * rowValues.currencyPerCoin;
        }
        if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
          coinQty = currencyQty / rowValues.currencyPerCoin;
        }
        if (rowValues.service === 'Liquidity pool') {
          coinQty /= 2;
        }
        if (!rowValues.currencyPerCoin) {
          currencyPerCoin = currencyQty / coinQty;
        } else {
          currencyPerCoin = rowValues.currencyPerCoin;
        }
        transactionRow.push({
          rowKey: new Hash(rowValues.rowKey + '#1').md5,
          account: rowValues.accountSender,
          contractor: rowValues.sender,
          project: project,
          coin: coinSymbol,
          quantity: coinQty * -1,
        });
        transactionRow.push({
          rowKey: new Hash(rowValues.rowKey + '#2').md5,
          account: accountRecipient,
          contractor: recipient,
          project: 'No project',
          coin: currencySymbol,
          quantity: currencyQty,
        });
      }
      if (currencySymbol && coinSymbol) {
        coinPrice =
          prices.getHistoricalPrice(
            rowValues.accountSender,
            project,
            dateTime,
            currencySymbol
          ) * currencyPerCoin || void 0;
      }
      transactionRow.forEach((tx) => {
        arrayOfObject.push({
          rowKey: tx.rowKey,
          dateTime: dateTime,
          account: tx.account.toLowerCase(),
          platform: rowValues.platform.toLowerCase(),
          service: rowValues.service.toLowerCase(),
          project: tx.project.toLowerCase(),
          contractor: tx.contractor.toLowerCase(),
          coin: tx.coin.toLowerCase(),
          quantity: tx.quantity,
          price: tx.coin === coinSymbol ? coinPrice : void 0,
          comment: rowValues.comment.toLowerCase(),
          registryRowNum: rowValues.rowNum,
          updateDate: updateDate,
        });
      });
    });
    const transactions = new Portfolio().getWorkSheet('transactions');
    if (this.workSheet.isRange) {
      arrayOfObject.forEach((tx) => {
        const oldRow = transactions.object[tx.rowKey];
        if (oldRow?.rowKey) {
          tx.rowNum = oldRow.rowNum;
          transactions.updateRow(tx);
        } else {
          transactions.insertRow(tx);
        }
      });
    } else {
      transactions.truncateInsertRows(arrayOfObject);
    }
  }
}

class HistoricalPrices {
  constructor(workSheet = '') {
    if (HistoricalPrices.exists) {
      return HistoricalPrices.instance
    }
    HistoricalPrices.instance = this;
    HistoricalPrices.exists = true;
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('HistoricalPrices');
  }

  updateHistoricalPrices() {
    const aggHistoricalPrices = new Portfolio()
      .getWorkSheet('transactions')
      .arrayOfObject.filter((tx) => tx.price)
      .reduce((agg, tx) => {
        if (!agg[tx.account]) {
          agg[tx.account] = {};
        }
        if (!agg[tx.account][tx.project]) {
          agg[tx.account][tx.project] = {};
        }
        if (!agg[tx.account][tx.project][tx.coin]) {
          agg[tx.account][tx.project][tx.coin] = {};
          agg[tx.account][tx.project][tx.coin]['quantity'] = 0;
          agg[tx.account][tx.project][tx.coin]['cost'] = 0;
          agg[tx.account][tx.project][tx.coin]['quantityBuy'] = 0;
          agg[tx.account][tx.project][tx.coin]['costBuy'] = 0;
          agg[tx.account][tx.project][tx.coin]['quantitySell'] = 0;
          agg[tx.account][tx.project][tx.coin]['costSell'] = 0;
        }
        const quantity = tx.quantity < 0 ? Math.abs(tx.quantity) : tx.quantity;
        const quantityBuy = tx.quantity > 0 ? tx.quantity : 0;
        const quantitySell = tx.quantity < 0 ? Math.abs(tx.quantity) : 0;
        agg[tx.account][tx.project][tx.coin]['quantity'] += quantity;
        agg[tx.account][tx.project][tx.coin]['cost'] += quantity * tx.price;
        agg[tx.account][tx.project][tx.coin]['quantityBuy'] += quantityBuy;
        agg[tx.account][tx.project][tx.coin]['costBuy'] +=
          quantityBuy * tx.price;
        agg[tx.account][tx.project][tx.coin]['quantitySell'] += quantitySell;
        agg[tx.account][tx.project][tx.coin]['costSell'] +=
          quantitySell * tx.price;
        return agg
      }, {});
    const avgHistoricalPricesArrayOfObject = [];
    Object.entries(aggHistoricalPrices).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([project, level1]) => {
        Object.entries(level1).forEach(([symbol, object]) => {
          const avgPrice = object.cost / object.quantity || void 0;
          if (avgPrice) {
            avgHistoricalPricesArrayOfObject.push({
              rowKey: new Hash(account + project + symbol).md5,
              account,
              project,
              symbol,
              quantity: object.quantity,
              priceAvg: object.cost / object.quantity || void 0,
              priceBuy: object.costBuy / object.quantityBuy || void 0,
              priceSell: object.costSell / object.quantitySell || void 0,
            });
          }
        });
      });
    });
    this.workSheet.truncateInsertRows(avgHistoricalPricesArrayOfObject);
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

class Balance {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Balance');
  }

  updateBalance() {
    const newArrayOfObject = [];
    const historicalPrices = new Portfolio().getWorkSheet('historicalPrices')
      .object;
    const prices = new Portfolio().getWorkSheet('prices').object;
    const contractors = new Portfolio().getWorkSheet('contractors').object;
    const transactions = new Portfolio().getWorkSheet('transactions')
      .arrayOfObject;
    const aggBalance = transactions.reduce((object, tx) => {
      if (!object[tx.account]) {
        object[tx.account] = {};
      }
      if (!object[tx.account][tx.contractor]) {
        object[tx.account][tx.contractor] = {};
      }
      if (!object[tx.account][tx.contractor][tx.service]) {
        object[tx.account][tx.contractor][tx.service] = {};
      }
      if (!object[tx.account][tx.contractor][tx.service][tx.project]) {
        object[tx.account][tx.contractor][tx.service][tx.project] = {};
      }
      if (!object[tx.account][tx.contractor][tx.service][tx.project][tx.coin]) {
        object[tx.account][tx.contractor][tx.service][tx.project][tx.coin] = 0;
      }
      object[tx.account][tx.contractor][tx.service][tx.project][tx.coin] +=
        tx.quantity;
      return object
    }, {});
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([contractor, level1]) => {
        Object.entries(level1).forEach(([service, level2]) => {
          Object.entries(level2).forEach(([project, level3]) => {
            Object.entries(level3).forEach(([coin, quantity]) => {
              const quantityRound = Math.round(quantity * 1000) / 1000;
              if (quantityRound) {
                const currentCost =
                  quantityRound * prices[new Hash(coin).md5]?.price;
                const coinType = prices[new Hash(coin).md5]?.coinType;
                const historicalCostBuy =
                  quantityRound *
                    historicalPrices[new Hash(account + project + coin).md5]
                      ?.priceBuy || 0;
                const historicalCostAvg =
                  quantityRound *
                    historicalPrices[new Hash(account + project + coin).md5]
                      ?.priceAvg || 0;
                const risk = prices[new Hash(coin).md5]?.risk;
                newArrayOfObject.push({
                  account: account.toUpperCase(),
                  contractor: contractor.toUpperCase(),
                  contractorType: contractors[
                    new Hash(contractor).md5
                  ].type.toUpperCase(),
                  service: service.toUpperCase(),
                  project: project.toUpperCase(),
                  coin: coin.toUpperCase(),
                  coinType: coinType.toUpperCase(),
                  risk: risk.toUpperCase(),
                  quantity: quantityRound,
                  historicalCostBuy,
                  historicalCostAvg,
                  currentCost,
                });
              }
            });
          });
        });
      });
    });
    this.workSheet.truncateInsertRows(newArrayOfObject);
  }
}

function updateTransactions() {
  new Registry().updateTransactions();
}

function updatePrices() {
  new Promise((resolve) => {
    new Prices().updatePrices();
    resolve();
  }).then(() => {
    new Promise((resolve) => {
      new HistoricalPrices().updateHistoricalPrices();
      resolve();
    }).then(() => {
      new Balance().updateBalance();
    });
  });
}

function updateCoins() {
  new Coins().updateCoins();
}

function updateBalance() {
  new Promise((resolve) => {
    new HistoricalPrices().updateHistoricalPrices();
    resolve();
  }).then(() => {
    new Balance().updateBalance();
  });
}

function updateOnEdit(editRange) {
  try {
    SpreadsheetApp.getActive().toast('Check update.', 'Save process: ', 1);
    const workSheet = new Portfolio().updateOnEdit(editRange.range);
    if (workSheet.isChangePrimaryKey) {
      workSheet.savePrimaryKeyChanges();
    } else if (workSheet.isNotNull) {
      const startDate = new FormatDate();
      if (new Hash(workSheet.sheetName).md5 === new Hash('prices').md5) {
        new Prices(workSheet).updateId();
      } else if (workSheet.sheetName.match(new RegExp('[Registry]+', 'g'))) {
        const ui = SpreadsheetApp.getUi(); // Same variations.
        const result = ui.alert('Data update', 'Save?', ui.ButtonSet.YES_NO);
        if (result == ui.Button.YES) {
          new Registry(workSheet).updateTransactions();
        }
      }
      SpreadsheetApp.getActive().toast(
        'Save time: ' + startDate.getTimeDiff(),
        'Save process: ',
        3
      );
    }
  } catch (error) {
    SpreadsheetApp.getActive().toast('Error: ' + error, 'Save process: ', 3);
  }
}

function createMenu() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Portfolio');
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update balance', 'updateBalance')
      .addItem('Update prices', 'updatePrices')
      .addItem('Update coins', 'updateCoins')
  );
  menu.addToUi();
}
