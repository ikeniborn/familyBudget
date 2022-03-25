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
    return Object.keys(head)
      .filter((column) => head[column].notNull)
      .every((column) => (rowValues[column] ? true : false))
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
   * @param {*} headerRowNum
   * @returns
   */
  constructor(spreadSheetName = '', sheetName = '', headerRowNum = 1) {
    super(spreadSheetName);
    if (WorkSheet.key === new Hash(sheetName).md5) {
      return WorkSheet.instance
    }
    WorkSheet.instance = this;
    this.workSheetKey = new Hash(sheetName).md5;
    this.sheetName = sheetName;
    this.workSheet = this.workSheets[this.workSheetKey];
    this.metadata = new WorkSheetMetadata(this.workSheet);
    this.getRange(headerRowNum);
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
    const dataRange = this.workSheet.getDataRange();
    this.headerRowNum = headerRowNum;
    this.countRow = dataRange.getNumRows() - this.headerRowNum;
    this.countColumn = dataRange.getNumColumns();
    //* формирование заголовка
    this.headerRange = dataRange.offset(
      this.headerRowNum - 1,
      0,
      1,
      this.countColumn
    );
    this.dataRange =
      this.countRow > 0
        ? dataRange.offset(
            this.headerRowNum,
            0,
            this.countRow,
            this.countColumn
          )
        : this.headerRange;
    return this
  }

  getFact(head) {
    const firstRowNum = this.headerRowNum + 1;
    const headKey = Object.keys(head);
    return this.dataRange
      .getValues()
      .reduce((valuesWithKey, rowValues, index) => {
        const rowNum = firstRowNum + index;
        let rowKey;
        if (head?.rowKey) {
          rowKey = rowValues[head.rowKey.idx];
        } else {
          rowKey = new Hash(rowNum + this.sheetName).md5;
        }
        if (!valuesWithKey[rowKey]) {
          valuesWithKey[rowKey] = rowValues.reduce((object, value, index) => {
            if (!head?.rowKey) {
              object['rowKey'] = rowKey;
            }
            object['rowNum'] = rowNum;
            if (!object[headKey[index]]) {
              object[headKey[index]] = value;
            }
            return object
          }, {});
        }
        return valuesWithKey
      }, {})
  }

  getDimension(head) {
    const firstRowNum = this.headerRowNum + 1;
    const headKey = Object.keys(head);
    return this.dataRange
      .getValues()
      .reduce((arrayOfObject, rowValues, rowIndex) => {
        const rowNum = firstRowNum + rowIndex;
        const rowKey = rowValues[head.rowKey.idx];
        if (!arrayOfObject[rowKey]) {
          arrayOfObject[rowKey] = rowValues.reduce((object, value, index) => {
            if (!object[headKey[index]]) {
              object[headKey[index]] = value;
            }
            object['rowNum'] = rowNum;
            return object
          }, {});
        }
        return arrayOfObject
      }, {})
  }

  insertRows(arrayOfObject = [], head = {}, firstRow = 1, firstColumn = 1) {
    const headOrder = Object.keys(head);
    const array = arrayOfObject.reduce(
      (values, rowObject) => {
        const rowArray = headOrder.map((value) => rowObject[value]);
        values.push(rowArray);
        return values
      },
      [new Header().getHeaderAlias(head)]
    );
    if (array.length) {
      const insertRowsPromise = async () => {
        return new Promise((resolve) => {
          this.deleteFilter();
          resolve();
        }).then(async () => {
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
      // this.deleteFilter()
      // this.workSheet
      //   .clear()
      //   .getRange(firstRow, firstColumn, array.length, array[0].length)
      //   .setValues(array)
      // this.deleteEmptyRows().deleteEmptyColumns()
      insertRowsPromise();
    }
    return this
  }

  updateRow(object = {}, head = {}) {
    if (object.rowNum !== this.headerRowNum) {
      const array = [Object.keys(head).map((column) => object[column])];
      // const updateRowPromise = async (object) => {
      //   return new Promise((resolve) => {
      //     this.deleteFilter()
      //     resolve(object)
      //   }).then(async (object) => {
      //     return new Promise((resolve) => {
      //       this.workSheet
      //         .clear()
      //         .getRange(object.rowNum, 1, array.length, array[0].length)
      //         .setValues(array)
      //       resolve()
      //     }).then(() => {
      //       this.deleteEmptyRows().deleteEmptyColumns()
      //     })
      //   })
      // }
      // updateRowPromise()
      this.workSheet
        .getRange(object.rowNum, 1, array.length, array[0].length)
        .setValues(array);
    }
  }

  insertRow(object = {}, head = {}) {
    const headOrder = Object.keys(head);
    const array = [object].reduce((values, rowObject) => {
      const rowArray = headOrder.map((value) => rowObject[value]);
      values.push(rowArray);
      return values
    }, [])[0];
    this.workSheet.appendRow(array);
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
}

class WorkSheetRange extends WorkSheet {
  constructor(spreadSheetName, sheetName, headerRowNum, range) {
    super(spreadSheetName, sheetName, headerRowNum);
    this.range = range;
    this.countRow = this.range.rowEnd - this.range.rowStart + 1;
    this.countColumn = this.range.columnEnd - this.range.columnStart + 1;
    this.rangeOffset = range.offset(
      0,
      1 - this.range.columnStart,
      this.countRow,
      this.maxColumn
    );
    this.rangeOffsetValues = this.rangeOffset.getValues();
    this.rowNumArray = [...Array(this.countRow).keys()].map(
      (m) => (m = m + this.range.rowStart)
    );
    this.columnNumArray = [...Array(this.countColumn).keys()].map(
      (m) => (m = m + this.range.columnStart)
    );
  }

  getArrayOfObject(head = {}) {
    const headKey = Object.keys(head);
    return this.rangeOffsetValues.map((rowArray, indexRow) => {
      const object = rowArray.reduce((object, value, index) => {
        if (!object[headKey[index]]) {
          object[headKey[index]] = value;
        }
        return object
      }, {});
      object.rowKey = new Header().getPrimaryKey(head, object);
      object.rowNum = this.range.rowStart + indexRow;
      return object
    })
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
    Object.keys(this.metadata).forEach((key) => {
      this.metadata[key].remove();
    });
  }
}

class WorkSheetMetadata extends Metadata {
  /**
   * Работа с метаданными листа
   * @param {object} sheet объект листа
   */
  constructor(sheet) {
    super(sheet);
    this.sheetName = sheet.getName().toUpperCase();
  }
  /**
   * Добавление ключа строки в метаданные
   * @param {number} rowNum номер строки листа
   */
  addRowKey(rowNum, value) {
    const key = 'ROWKEY_' + rowNum;
    super.addMetadata(key, value);
    return value
  }
  /**
   * Получение ключа строки с листа
   * @param {number} rowNum номер строки листа
   * @returns строка в формате Hash
   */
  getRowKey(rowNum) {
    const key = 'ROWKEY_' + rowNum;
    return super.getMetadata(key)
  }
  /**
   * Добавление ключа листа в метаданные
   * @param {string} sheetKey ключ листа в формате Hash
   */
  addSheetKey() {
    const value = new Hash(this.sheetName).md5;
    super.addMetadata('SHEETKEY', value);
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
    const oldValue = new ETL(super.getMetadata('COUNTCHANGE')).toNumber() || 0;
    let newValue;
    if (clear) {
      newValue = 0;
    } else {
      newValue = oldValue + 1;
    }
    super.addMetadata('COUNTCHANGE', newValue);
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
    const oldValue = super.getMetadata('SHEETNAME');
    if (oldValue) {
      return oldValue
    } else {
      super.addMetadata('SHEETNAME', this.sheetName);
      return this.sheetName
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
    this.header = new Header();
    this.head = {
      registry: {
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
        currency: { alias: 'Currency', idx: 10, notNull: true },
        currencyQty: { alias: 'Currency, qty', idx: 11 },
        currencyPerCoin: { alias: 'Currency per coin', idx: 12 },
        feeCurrency: { alias: 'Fee currency', idx: 13 },
        feeQty: { alias: 'Fee, qty', idx: 14 },
        comment: { alias: 'Comment', idx: 15 },
        date: { alias: 'Date', idx: 16, notNull: true },
        time: { alias: 'Time', idx: 17, notNull: true },
      },
      prices: {
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
        risk: { alias: 'Risk', idx: 4 },
        id: { alias: 'Id', idx: 5 },
        price: { alias: 'Price', idx: 6 },
      },
      transactions: {
        rowKey: { alias: 'Row key', idx: 0 },
        dateTime: { alias: 'Date and time', idx: 1 },
        account: { alias: 'Account', idx: 2 },
        platform: { alias: 'Platform', idx: 3 },
        service: { alias: 'Service', idx: 4 },
        project: { alias: 'Project', idx: 5 },
        contractor: { alias: 'Contractor', idx: 6 },
        coin: { alias: 'Coin', idx: 7 },
        quantity: { alias: 'Quantity', idx: 8 },
        price: { alias: 'Price, $', idx: 9 },
        comment: { alias: 'Comment', idx: 10 },
        actionKey: { alias: 'Action key', idx: 11 },
      },
      balance: {
        account: { alias: 'Account', idx: 0 },
        contractor: { alias: 'Contractor', idx: 1 },
        contractorType: { alias: 'Contractor type', idx: 2 },
        project: { alias: 'Project', idx: 3 },
        coin: { alias: 'Coin', idx: 4 },
        risk: { alias: 'Risk', idx: 5 },
        quantity: { alias: 'Quantity', idx: 6 },
        historicalCost: { alias: 'Historical cost, $', idx: 7 },
        currentCost: { alias: 'Current cost, $', idx: 8 },
      },
      historicalPrices: {
        rowKey: { alias: 'Row key', idx: 0 },
        account: { alias: 'Account', pk: true, idx: 1 },
        symbol: { alias: 'Coin', pk: true, idx: 2 },
        price: { alias: 'Price, $', idx: 3 },
      },
      coins: {
        rowKey: { alias: 'Row key', idx: 0 },
        source: { alias: 'Source', pk: true, idx: 1 },
        name: { alias: 'Name', pk: true, idx: 2 },
        symbol: { alias: 'Symbol', pk: true, idx: 3 },
        id: { alias: 'Id', idx: 4 },
      },
      sources: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
      },
      services: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
      },
      operations: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
      },
      project: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
      },
      contractors: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
        type: { alias: 'Type', idx: 2 },
        category: { alias: 'Category', idx: 3 },
      },
    };
    this.spreadSheetName = 'portfolio';
  }
}

class Registry {
  constructor() {
    this.head = new Portfolio().head.registry;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.workSheet = new WorkSheet(this.spreadSheetName, 'registry', 1);
    this.values = this.workSheet.getFact(this.head);
  }

  /**
   *
   * @returns {array} Return array of object
   */
  getRegistryOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      'registry',
      1,
      range
    );
    return this.workSheetRange.rowNumArray.map((rowNum) => {
      const rowKey = new Hash(rowNum + this.workSheetRange.sheetName).md5;
      const factRow = this.values[rowKey];
      factRow.rowKey = rowKey;
      const isNotNull = new Header().isNotNull(this.head, factRow);
      return isNotNull ? factRow : []
    })
  }

  /**
   *
   * @returns {array} Return array of object
   */
  getRegistry() {
    return Object.values(new Registry().values)
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

      // const response = UrlFetchApp.fetch(this.url, this.data)
      // const text = response.getContentText()
      // const responseCode = response.getResponseCode()
      // if (responseCode !== 200) {
      //   console.log('URL: ', this.url)
      //   console.log('Response code: ', responseCode)
      //   console.log('Content Text: ', response.getContentText())
      // } else {
      //   return JSON.parse(text)
      // } return
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
}
/**
 * CryptoRank coin list
 */
class CoinsList$3 {
  constructor() {
    this.methods = new Instance$3().methods;
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
    const upperTsyms = tsyms.toUpperCase();
    return Object.entries(
      this.methods.get({
        endPoint: '/pricemulti',
        query: {
          fsyms: fsyms.toUpperCase(),
          tsyms: tsyms.toUpperCase(),
          relaxedValidation: true,
        },
      })
    ).map(([symbol, tsymsValue]) => {
      return { symbol: symbol, price: tsymsValue[upperTsyms] }
    })
  }

  getMultiFullPrice(fsyms = '', tsyms = 'USD') {
    const upperTsyms = tsyms.toUpperCase();
    return Object.entries(
      this.methods.get({
        endPoint: '/pricemultifull',
        query: {
          fsyms: fsyms.toUpperCase(),
          tsyms: tsyms.toUpperCase(),
          relaxedValidation: true,
        },
      })
    ).map(([symbol, tsymsValue]) => {
      return [symbol, tsymsValue[upperTsyms]]
    })
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
class CoinsList$2 {
  constructor() {
    this.methods = new Instance$2().methods;
  }
  getCoinsList() {
    return this.methods.get({ endPoint: '/all/coinlist' })?.Data
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
 * CoinMarketCap coin list
 */
class CoinsList$1 {
  constructor() {
    this.methods = new Instance$1().methods;
  }
  /**
   * Get coins list
   *
   * @returns {array}
   */
  getCoinsList() {
    return this.methods.get({
      endPoint: '/v1/cryptocurrency/map',
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

class Coins {
  constructor() {
    this.head = new Portfolio().head.coins;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Coins';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
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
    // SpreadsheetApp.openById('1wTTuxXt8n9q7C4NDXqQpI3wpKu1_5bGVmP9Xz0XGSyU')
    //   .getSheetByName('CoinGecko Token API List')
    //   .getDataRange()
    //   .getValues()
    //   .slice(1)
    //   .forEach((coin) => {
    //     const key = new Hash('coingecko' + coin[2] + coin[1])
    //     coins.push({
    //       rowKey: key.md5,
    //       source: 'coingecko',
    //       name: coin[2],
    //       symbol: coin[1],
    //       id: coin[0],
    //     })
    //   })
    new CoinsList$3().getCoinsList(15000).forEach((coin) => {
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
    this.workSheet.insertRows(coins, this.head);
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum);
    });
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }
}

class Prices {
  constructor() {
    this.head = new Portfolio().head.prices;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Prices';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
  }

  getOnEdit(range) {
    const coins = new Coins().values;
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    console.log(this.arrayOfObject);
    this.arrayOfObject.map((object) => {
      const coin = Object.values(coins).filter((row) => {
        return (
          new RegExp(object.name.toString().toLowerCase(), 'g').test(
            row.name.toString().toLowerCase()
          ) &&
          new Hash(object.source).md5 === new Hash(row.source).md5 &&
          new Hash(object.symbol).md5 === new Hash(row.symbol).md5
        )
      })[0];
      object.id = coin?.id || void 0;
      object.isNotNull = new Header().isNotNull(this.head, object);
      object.isChangePrimaryKey = new Header().isChangePrimaryKey(
        this.head,
        object
      );
      return object
    });
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      if (object.isNotNull || object.isChangePrimaryKey) {
        this.workSheet.updateRow(object, this.head);
      }
    });
  }

  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }

  getPrice(date, symbol, convert = 'usd') {
    const coinRow = this.values[new Hash(symbol).md5];
    const source = coinRow.source;
    const id = coinRow.id;
    const risk = coinRow.risk;
    if (new Hash('Stablecoin').md5 !== new Hash(risk).md5) {
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
        if (new Hash(source).md5 === new Hash('cryptocompare').md5) {
          return new Price$2().getHistoryPrice(id, date, convert)
        }
      }
    } else {
      return 1
    }
  }

  updatePrices() {
    const listId = Object.fromEntries(
      Object.entries(
        Object.values(this.values).reduce((list, object) => {
          if (!list[object.source]) {
            list[object.source] = [];
          }
          if (object.id) {
            list[object.source].push(object.id);
          }
          return list
        }, {})
      ).map(([source, idArray]) => [source, idArray.join(',')])
    );
    const updatePrice = (symbol, price, rank = '') => {
      const coin = this.values[new Hash(symbol).md5];
      if (price) {
        coin.price = price;
      }
      if (
        ['stablecoin', 'fiat']
          .map((value) => new Hash(value).md5)
          .indexOf(new Hash(coin.risk).md5) === -1
      ) {
        if (!rank) {
          coin.risk = 'High';
        } else if (rank < 100) {
          coin.risk = 'Low';
        } else if (rank < 1000) {
          coin.risk = 'Middle';
        } else if (rank > 1000) {
          coin.risk = 'High';
        }
      }
    };
    const getCurrentPrice = () => {
      return new Promise((resolve) => {
        if (listId.cryptorank) {
          new Price$3()
            .getLastPrice(listId.cryptorank)
            .forEach((coin) => {
              updatePrice(coin.symbol, coin.values.USD.price, coin.rank);
            });
        }
        if (listId.coingecko) {
          new Price()
            .getMarketsPrice(listId.coingecko)
            .forEach((coin) => {
              updatePrice(coin.symbol, coin.current_price, coin.market_cap_rank);
            });
        }
        if (listId.coinmarketcap) {
          Object.values(
            new Price$1().getLastPrice(listId.coinmarketcap)
          ).forEach((coin) => {
            updatePrice(coin.symbol, coin.quote.USD.price, coin.cmc_rank);
          });
        }
        if (listId.cryptocompare) {
          new Price$2()
            .getMultiPrice(listId.cryptocompare)
            .forEach((coin) => {
              updatePrice(coin.symbol, coin.price, 100);
            });
        }
        resolve();
      })
    };
    getCurrentPrice().then(() => {
      this.workSheet.insertRows(Object.values(this.values), this.head);
    });
  }
}

class HistoricalPrices {
  constructor() {
    this.head = new Portfolio().head.historicalPrices;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'HistoricalPrices';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
  }

  getOnEdit(range) {
    this.arrayOfObject = this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    ).getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum);
    });
  }

  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }

  // getPreviousPrice(date, coin, pair = 'usd') {
  //   const histirocalPricesCoin = Object.values(this.values).filter(
  //     (row) =>
  //       new Hash(row.coin).md5 === new Hash(coin).md5 &&
  //       new FormatDate(row.date).unix <= new FormatDate(date).unix
  //   )
  //   const lastDate = Math.max(
  //     ...histirocalPricesCoin.map((row) => new Date(row.date).valueOf())
  //   )
  //   const lastHistoricalPriceKey = new Hash(
  //     new Date(lastDate).valueOf() + coin + pair
  //   ).md5
  //   return this.values[lastHistoricalPriceKey].price
  // }

  updateHistoricalPrices() {
    const transactions = Object.values(new Transactions().values).filter(
      (row) => row.price
    );
    const aggHistoricalPrices = transactions.reduce((agg, row) => {
      if (!agg[row.account]) {
        agg[row.account] = {};
      }
      if (!agg[row.account][row.coin]) {
        agg[row.account][row.coin] = {};
        agg[row.account][row.coin]['quantity'] = 0;
        agg[row.account][row.coin]['cost'] = 0;
      }
      const quantity = row.quantity < 0 ? Math.abs(row.quantity) : row.quantity;
      agg[row.account][row.coin]['quantity'] += quantity;
      agg[row.account][row.coin]['cost'] += quantity * row.price;
      return agg
    }, {});
    const avgHistoricalPricesArrayOfObject = [];
    Object.entries(aggHistoricalPrices).forEach(([account, symbolValue]) => {
      Object.entries(symbolValue).forEach(([symbol, values]) => {
        values.price = values.cost / values.quantity;
        avgHistoricalPricesArrayOfObject.push({
          rowKey: new Hash(account + symbol).md5,
          account,
          symbol,
          price: values.cost / values.quantity,
        });
      });
    });
    this.workSheet.insertRows(avgHistoricalPricesArrayOfObject, this.head);
  }
}

class Transactions {
  constructor() {
    this.head = new Portfolio().head.transactions;
    this.header = new Header();
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.workSheet = new WorkSheet(this.spreadSheetName, 'transactions');
    this.values = this.workSheet.getFact(this.head);
  }

  getTransactions(arrayOfObject = []) {
    this.transactions = [];
    const prices = new Prices();
    const historicalPrices = new HistoricalPrices().values;
    arrayOfObject.forEach((rowValues, indexTx) => {
      const transactionRow = [];
      const hhmm = new FormatNumber(rowValues.time).getHourAndMinuteFromNumber();
      const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
        .date;
      const accountRecipient = rowValues.accountRecipient
        ? rowValues.accountRecipient
        : rowValues.accountSender;
      const recipient = rowValues.recipient
        ? rowValues.recipient
        : rowValues.sender;

      let coinQty, currencyQty, currencyPerCoin, coinSymbol, coinPrice;
      if (
        ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !== -1
      ) {
        if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            dateTime: dateTime,
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            coin: rowValues.coin,
            quantity: rowValues.coinQty * -1,
          });
        }
        if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            coin: rowValues.coin,
            quantity: rowValues.coinQty,
          });
        }
      } else if (['Buy'].indexOf(rowValues.operation) !== -1) {
        coinQty = rowValues.coinQty;
        currencyQty = rowValues.currencyQty;
        coinSymbol = rowValues.coin;
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
          account: rowValues.accountSender,
          contractor: rowValues.sender,
          coin: rowValues.currency,
          quantity: currencyQty * -1,
        });
        transactionRow.push({
          account: accountRecipient,
          contractor: recipient,
          coin: rowValues.coin,
          quantity: coinQty,
        });
      } else if (['Sell'].indexOf(rowValues.operation) !== -1) {
        coinQty = rowValues.coinQty;
        currencyQty = rowValues.currencyQty;
        coinSymbol = rowValues.coin;
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
          account: rowValues.accountSender,
          contractor: rowValues.sender,
          coin: rowValues.coin,
          quantity: coinQty * -1,
        });
        transactionRow.push({
          account: accountRecipient,
          contractor: recipient,
          coin: rowValues.currency,
          quantity: currencyQty,
        });
      }
      if (rowValues.currency && coinSymbol) {
        coinPrice =
          prices.getPrice(dateTime, rowValues.currency) * currencyPerCoin;
      }
      transactionRow.forEach((tx) => {
        this.transactions.push({
          dateTime: dateTime,
          account: tx.account,
          platform: rowValues.platform,
          service: rowValues.service,
          project: rowValues.project,
          contractor: tx.contractor,
          coin: tx.coin,
          quantity: tx.quantity,
          price:
            tx.coin === coinSymbol
              ? coinPrice
                ? coinPrice
                : historicalPrices[new Hash(tx.account + coinSymbol)]?.price
              : void 0,
          comment: rowValues.comment,
          actionKey: rowValues.rowKey,
        });
      });
    });
    return this
  }

  updateInsertTransactions() {
    this.transactions.forEach((row) => {
      const oldRow = Object.values(this.values).filter(
        (oldRow) => oldRow.actionKey === row.actionKey
      )[0];
      let rowNum;
      if (oldRow) {
        row.rowKey = oldRow.rowKey;
        row.rowNum = oldRow.rowNum;
        delete this.values[oldRow.rowKey];
        this.workSheet.updateRow(row, this.head);
      } else {
        rowNum = this.workSheet.lastRow + 1;
        row.rowKey = new Hash(rowNum + this.workSheet.sheetName).md5;
        this.workSheet.insertRow(row, this.head);
      }
    });
  }

  truncateInsertTrasactions() {
    let rowNum;
    const rows = this.transactions.map((row, index) => {
      rowNum = index + 1;
      row.rowKey = new Hash(rowNum + this.workSheet.sheetName).md5;
      return row
    });
    this.workSheet.insertRows(rows, this.head);
  }

  updateTransactionsOnEdit(range) {
    const registryOnEdit = new Registry().getRegistryOnEdit(range);
    if (registryOnEdit.length) {
      new Transactions()
        .getTransactions(registryOnEdit)
        .updateInsertTransactions();
    }
  }
}

class Contractors {
  constructor() {
    this.head = new Portfolio().head.contractors;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Contractors';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head);
    });
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }
}

class Operations {
  constructor() {
    this.head = new Portfolio().head.operations;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Operations';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum);
    });
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }
}

class Services {
  constructor() {
    this.head = new Portfolio().head.operations;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Services';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    Object.keys(this.head);
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum);
    });
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }
}

class Accounts {
  constructor() {
    this.head = new Portfolio().head.operations;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Accounts';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum);
    });
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }
}

class Sources {
  constructor() {
    this.head = new Portfolio().head.sources;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Sources';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum);
    });
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }
}

class Project {
  constructor() {
    this.head = new Portfolio().head.operations;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Project';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    this.values = this.workSheet.getDimension(this.head);
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum);
    });
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }
}

class Balance {
  constructor() {
    this.head = new Portfolio().head.balance;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.sheetName = 'Balance';
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName);
    // this.values = this.workSheet.getFact(this.head)
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    );
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head);
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum);
    });
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert();
  }

  updateBalance() {
    const historicalPrices = new HistoricalPrices().values;
    const prices = new Prices().values;
    const contractors = new Contractors().values;
    const aggBalance = Object.values(new Transactions().values).reduce(
      (object, tx) => {
        if (!object[tx.account]) {
          object[tx.account] = {};
        }
        if (!object[tx.account][tx.contractor]) {
          object[tx.account][tx.contractor] = {};
        }
        if (!object[tx.account][tx.contractor][tx.project]) {
          object[tx.account][tx.contractor][tx.project] = {};
        }
        if (!object[tx.account][tx.contractor][tx.project][tx.coin]) {
          object[tx.account][tx.contractor][tx.project][tx.coin] = 0;
        }
        object[tx.account][tx.contractor][tx.project][tx.coin] += tx.quantity;
        return object
      },
      {}
    );
    const balance = [];
    Object.entries(aggBalance).forEach(([account, level0]) => {
      Object.entries(level0).forEach(([contractor, level1]) => {
        Object.entries(level1).forEach(([project, level2]) => {
          Object.entries(level2).forEach(([coin, quantity]) => {
            if (quantity) {
              const currentCost = quantity * prices[new Hash(coin).md5]?.price;
              const historicalCost =
                quantity *
                  historicalPrices[new Hash(account + coin).md5]?.price || 0;
              balance.push({
                account,
                contractor,
                contractorType: contractors[new Hash(contractor).md5].type,
                project,
                coin: coin.toUpperCase(),
                risk: prices[new Hash(coin).md5]?.risk,
                quantity,
                historicalCost,
                currentCost,
              });
            }
          });
        });
      });
    });
    this.workSheet.insertRows(balance, this.head);
  }
}

function updateTransactions() {
  const arrayOfObject = new Registry().getRegistry();
  new Transactions().getTransactions(arrayOfObject).truncateInsertTrasactions();
}

function updatePrices() {
  new Prices().updatePrices();
}

function updateHistoricalPrices() {
  new HistoricalPrices().updateHistoricalPrices();
}

function updateCoins() {
  new Coins().updateCoins();
}

function updateBalance() {
  new Balance().updateBalance();
}

function updateOnEdit(editRange) {
  try {
    const range = editRange.range;
    const workSheet = range.getSheet();
    const sheetName = workSheet.getSheetName();
    const sheetKey = new Hash(sheetName).md5;
    if (sheetKey === new Hash('Registry').md5) {
      new Transactions().updateTransactionsOnEdit(range);
      SpreadsheetApp.flush();
      new HistoricalPrices().updateHistoricalPrices();
      SpreadsheetApp.flush();
      new Balance().updateBalance();
    } else if (sheetKey === new Hash('Contractors').md5) {
      new Contractors().updateOnEdit(range);
    } else if (sheetKey === new Hash('HistoricalPrices').md5) {
      new HistoricalPrices().updateOnEdit(range);
    } else if (sheetKey === new Hash('Operations').md5) {
      new Operations().updateOnEdit(range);
    } else if (sheetKey === new Hash('Services').md5) {
      new Services().updateOnEdit(range);
    } else if (sheetKey === new Hash('Accounts').md5) {
      new Accounts().updateOnEdit(range);
    } else if (sheetKey === new Hash('Sources').md5) {
      new Sources().updateOnEdit(range);
    } else if (sheetKey === new Hash('Prices').md5) {
      new Prices().updateOnEdit(range);
    } else if (sheetKey === new Hash('Coins').md5) {
      new Coins().updateOnEdit(range);
    } else if (sheetKey === new Hash('Project').md5) {
      new Project().updateOnEdit(range);
    }
  } catch (error) {
    SpreadsheetApp.getActive().toast(
      'Update error: ' + error,
      'Update process',
      2
    );
  }
}

function createInvoiceMenu() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Library');
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('Update prices', 'updatePrices')
      .addItem('Update historical prices', 'updateHistoricalPrices')
      .addItem('Update transactions', 'updateTransactions')
      .addItem('Update balance', 'updateBalance')
      .addItem('Update coins', 'updateCoins')
  );
  menu.addToUi();
}
