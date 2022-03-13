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
  get str() {
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
    this.key = new Hash(sheetName).md5;
    this.sheetName = sheetName;
    this.workSheet = this.workSheets[this.key];
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
        const rowHash = new Hash(rowValues.join('#')).md5;
        if (!valuesWithKey[rowNum]) {
          valuesWithKey[rowNum] = {
            rowNum,
            rowHash,
            rowValues: rowValues.reduce((object, value, index) => {
              if (!object[headKey[index]]) {
                object[headKey[index]] = value;
              }
              return object
            }, {}),
          };
        }
        return valuesWithKey
      }, {})
  }

  getDimension(head) {
    const primeryKeyIndex = Object.values(head)
      .filter((value) => value.pk)
      .map((value) => value.idx);
    const headKey = Object.keys(head);
    return this.dataRange.getValues().reduce((valuesWithKey, values) => {
      const key = new Hash(
        primeryKeyIndex
          .map((keyIndex) => {
            const value = values[keyIndex];
            if (value instanceof Date) {
              return new Date(value).valueOf()
            } else {
              return value
            }
          })
          .join('#')
      );
      if (!valuesWithKey[key.md5]) {
        valuesWithKey[key.md5] = values.reduce((object, value, index) => {
          if (!object[headKey[index]]) {
            object[headKey[index]] = value;
          }
          return object
        }, {});
        valuesWithKey[key.md5].nkey = key.stringLowerCase;
        // valuesWithKey[key.md5].key = key.md5
      }
      return valuesWithKey
    }, {})
  }

  insertValues(values = [], header = [], firstRow = 1, firstColumn = 1) {
    values.splice(0, 0, header);
    if (values.length) {
      this.deleteFilter();
      this.workSheet
        .clear()
        .getRange(firstRow, firstColumn, values.length, values[0].length)
        .setValues(values);
      // this.deleteEmptyRows().deleteEmptyColumns()
    }
    return this
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
   *  Удаление пустых колоно
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
  addRowKey(rowNum, rowHash) {
    const key = 'ROWKEY_' + rowNum;
    const value = rowHash;
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

class Header {
  constructor() {
    this.registry = {
      date: { alias: 'Date', idx: 0 },
      time: { alias: 'Time', idx: 1 },
      operation: { alias: 'Operation', idx: 2 },
      accountSender: { alias: 'Account sender', idx: 3 },
      accountRecipient: { alias: 'Account recipient', idx: 4 },
      platform: { alias: 'Platform', idx: 5 },
      service: { alias: 'Service', idx: 6 },
      sender: { alias: 'Sender', idx: 7 },
      recipient: { alias: 'Recipient', idx: 8 },
      coin: { alias: 'Coin', idx: 9 },
      coinQty: { alias: 'Coin, qty', idx: 10 },
      currency: { alias: 'Currency', idx: 11 },
      currencyQty: { alias: 'Currency, qty', idx: 12 },
      currencyPerCoin: { alias: 'Currency per coin', idx: 13 },
      feeCurrency: { alias: 'Fee currency', idx: 14 },
      feeQty: { alias: 'Fee, qty', idx: 15 },
      comment: { alias: 'Comment', idx: 16 },
    };
    this.prices = {
      name: { alias: 'Name', permanent: true, pk: true, idx: 0 },
      symbol: { alias: 'Symbol', permanent: true, pk: true, idx: 2 },
      risk: { alias: 'Risk', permanent: true, idx: 3 },
      price: { alias: 'Price', idx: 4 },
      high24h: { alias: 'High 24h', idx: 5 },
      low24h: { alias: 'Low 24h', idx: 6 },
      percentChange24h: { alias: 'Change 24h, %', idx: 7 },
      percentChange7d: { alias: 'Change 7d, %', idx: 8 },
      percentChange30d: { alias: 'Change 30d, %', idx: 9 },
      percentChange3m: { alias: 'Change 3m, %', idx: 10 },
      percentChange6m: { alias: 'Change 6m, %', idx: 11 },
      volume24h: { alias: 'Volume 24h', idx: 12 },
      rank: { alias: 'Rank', idx: 13 },
      type: { alias: 'Type', idx: 14 },
      category: { alias: 'Category', idx: 15 },
      circulatingSupply: { alias: 'Circulating supply', idx: 16 },
      totalSupply: { alias: 'Total supply', idx: 17 },
      maxSupply: { alias: 'Max supply', idx: 18 },
      marketCap: { alias: 'Market cap', idx: 19 },
      marketCapChange24h: { alias: 'Market cap change 24h', idx: 20 },
      marketCapChangePercentage24h: {
        alias: 'Market cap change 24h, %',
        idx: 21,
      },
      fullyDilutedMarketCap: { alias: 'Fully diluted market cap', idx: 22 },
      ath: { alias: 'All total high (ATH) price', idx: 23 },
      athChangePercentage: { alias: 'ATH change, %', idx: 24 },
      athDate: { alias: 'ATH date', idx: 25 },
      atl: { alias: 'All total low (ATL) price', idx: 26 },
      atlChangePercentage: { alias: 'ATL change, %', idx: 27 },
      atlDate: { alias: 'ATL date', idx: 28 },
      lastUpdated: { alias: 'Last updated', idx: 29 },
      source: { alias: 'Source', idx: 30 },
    };
    this.transactions = {
      rowNum: { alias: 'Row num', idx: 0 },
      rowHash: { alias: 'Row hash', idx: 1 },
      date: { alias: 'Date', idx: 2 },
      account: { alias: 'Account', idx: 3 },
      platform: { alias: 'Platform', idx: 4 },
      service: { alias: 'Service', idx: 5 },
      contractor: { alias: 'Contractor', idx: 6 },
      type: { alias: 'Type', idx: 7 },
      coin: { alias: 'Coin', idx: 8 },
      pair: { alias: 'Pair', idx: 9 },
      currencyPerCoin: { alias: 'Currency per coin', idx: 10 },
      quantity: { alias: 'Quantity', idx: 11 },
      price: { alias: 'Price, $', idx: 12 },
      cost: { alias: 'Cost, $', idx: 13 },
      comment: { alias: 'Comment', idx: 14 },
    };
    this.balance = {
      date: { alias: 'Date', idx: 0 },
      account: { alias: 'Account', idx: 1 },
      contractor: { alias: 'Contractor', idx: 2 },
      type: { alias: 'Type', idx: 3 },
      coin: { alias: 'Coin', idx: 4 },
      quantity: { alias: 'Quantity', idx: 5 },
      historicalCost: { alias: 'Historical cost, $', idx: 6 },
      currentCost: { alias: 'Current cost, $', idx: 7 },
    };
    this.allocation = {
      account: { alias: 'Account', idx: 0 },
      type: { alias: 'Type', idx: 1 },
      coin: { alias: 'Coin', idx: 2 },
      quantity: { alias: 'Quantity', idx: 3 },
      currentCost: { alias: 'Current cost, $', idx: 4 },
    };
    this.historicalPrices = {
      date: { alias: 'Date', pk: true, idx: 0, type: 'date' },
      symbol: { alias: 'Symbol', pk: true, idx: 1 },
      pair: { alias: 'Pair', pk: true, idx: 2 },
      price: { alias: 'Price', idx: 3 },
    };
    this.coins = {
      source: { alias: 'Source', pk: true, idx: 2 },
      name: { alias: 'Name', pk: true, idx: 3 },
      symbol: { alias: 'Symbol', pk: true, idx: 4 },
      id: { alias: 'Id', idx: 5 },
    };
    this.sources = {
      name: { alias: 'Name', pk: true, idx: 0 },
    };
    this.contractors = {
      name: { alias: 'Name', pk: true, idx: 0 },
      type: { alias: 'Type', idx: 1 },
      category: { alias: 'Category', idx: 2 },
    };
  }
  /**
   * Get head alias
   * @param {object} head Header object
   * @returns {array}
   */
  getHeaderAlias(head) {
    return Object.values(head).map((m) => m.alias)
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
    spreadSheetName: 'coingecko',
    sheetId: '1wTTuxXt8n9q7C4NDXqQpI3wpKu1_5bGVmP9Xz0XGSyU',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1iGoWj5YHB_iQi7o09-vJF6XJeveFI54lLOlx193Y0f8',
    scriptId: '19LYhtfrshQkWLvGQedmXFG4XJkcOR3cO9-E6Ne32GmKT766phfg71J_d',
    area: 'dev',
  },
  {
    spreadSheetName: 'coingecko',
    sheetId: '1wTTuxXt8n9q7C4NDXqQpI3wpKu1_5bGVmP9Xz0XGSyU',
    scriptId: '1HVxNmr_vVQNl6DS1g1aBscXDTJSmGdHRkxBAzAmqaasvs7y7hnTZvh7y',
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
    this.head = new Header();
    this.spreadSheetName = 'portfolio';
  }
}

class Registry {
  constructor() {
    this.head = new Portfolio().head;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.workSheet = new WorkSheet(this.spreadSheetName, 'registry', 1);
    this.values = this.workSheet.getFact(this.head.registry);
  }

  getRow(editRange) {
    this.eMap = new Map(Object.entries(editRange));
    const rowNum = this.eMap.get('range').rowStart;
    const rowValues = this.values[rowNum];
    const oldRowHash = this.workSheet.metadata.getRowKey(rowNum);
    const isNewRow = oldRowHash !== rowValues.rowHash ? true : false;
    if (isNewRow) {
      this.workSheet.metadata.addRowKey(rowNum, rowValues.rowHash);
    }
    return rowValues
  }
  // updateUsdPerCurrency(editRange) {
  //   this.eMap = new Map(Object.entries(editRange))
  //   if (this.eMap.has('range')) {
  //     if (
  //       this.eMap.get('range').columnStart === this.head.registry.currency.num
  //     ) {
  //       const rowNum = this.eMap.get('range').rowStart
  //       const rowIndex = rowNum - 2
  //       const rowValues = this.workSheet.dataValues.filter(
  //         (row, index) => index === rowIndex
  //       )[0]
  //       const currency = rowValues[this.head.registry.currency.idx]
  //       const time = new utils.FormatNumber(
  //         rowValues[this.head.registry.time.idx]
  //       ).getHourAndMinuteFromNumber()
  //       const dateTime = new utils.FormatDate(
  //         rowValues[this.head.registry.date.idx]
  //       ).addTime(time.h, time.m).date
  //       const price = new cryptoCompare.Price(
  //         cryptoCompareInstance
  //       ).getHistoryPrice(currency, dateTime)[currency.toUpperCase()].USD
  //       this.workSheet.portfolio.registry.insertValue(
  //         price,
  //         rowNum,
  //         this.head.registry.usdPerCurrency.num
  //       )
  //     }
  //   }
  // }
}

class Contractors {
  constructor() {
    this.head = new Portfolio().head;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.workSheet = new WorkSheet(this.spreadSheetName, 'contractors');
    this.values = this.workSheet.getDimension(this.head.contractors);
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
 * CryptoCompare instance
 */
class Instance {
  /**
   * Create new inctance API CryptoCompare
   *
   * @param {string} apiKey
   */
  constructor(apiKey) {
    this.methods = new Methods({
      domain: 'https://min-api.cryptocompare.com/data',
      query: { api_key: apiKey },
      data: {
        muteHttpExceptions: true,
        contentType: 'application/json',
      },
    });
  }
}

new Instance(
  '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125'
);

class Transactions {
  constructor() {
    this.head = new Portfolio().head;
    this.spreadSheetName = new Portfolio().spreadSheetName;
    this.workSheet = new WorkSheet(this.spreadSheetName, 'transactions');
  }

  updateTransactions() {
    // const currentFormatDate = new FormatDate()
    const transaction = [];
    const contractors = new Contractors().values;
    // const currentCoinPrice = this.workSheet.portfolio.price.dataValues.reduce(
    //   (list, row) => {
    //     const key = new Hash(
    //       currentFormatDate.yyyymmdd + row[this.head.price.symbol.idx] + 'USD'
    //     )
    //     if (row[this.head.price.price.idx]) {
    //       list[key.md5] = {
    //         rowKey: key.md5,
    //         rowNkey: key.stringUpperCase,
    //         dateKey: currentFormatDate.md5,
    //         date: currentFormatDate.getFormatDate('yyyy-MM-dd'),
    //         symbol: row[this.head.price.symbol.idx].toUpperCase(),
    //         pair: 'USD',
    //         price: row[this.head.price.price.idx],
    //       }
    //     }
    //     return list
    //   },
    //   {}
    // )

    // const historicalCoinPrice = this.workSheet.portfolio.historicalPrice.dataValues.reduce(
    //   (list, row) => {
    //     const rowKey = row[this.head.historicalPrice.rowKey.idx]
    //     if (!list[rowKey]) {
    //       list[rowKey] = {
    //         rowKey: row[this.head.historicalPrice.rowKey.idx],
    //         rowNkey: row[this.head.historicalPrice.rowNkey.idx],
    //         dateKey: row[this.head.historicalPrice.dateKey.idx],
    //         date: row[this.head.historicalPrice.date.idx],
    //         symbol: row[this.head.historicalPrice.symbol.idx],
    //         pair: row[this.head.historicalPrice.pair.idx],
    //         price: row[this.head.historicalPrice.price.idx],
    //       }
    //     }
    //     return list
    //   },
    //   currentCoinPrice
    // )
    const registry = new Registry();
    // console.log(registry.values)
    Object.values(registry.values).forEach((values) => {
      const transactionRow = [];
      const rowValues = values.rowValues;
      // const rowValues = {
      //   date: row[this.head.registry.date.idx],
      //   time: row[this.head.registry.time.idx],
      //   operation: row[this.head.registry.operation.idx],
      //   accountSender: row[this.head.registry.accountSender.idx],
      //   accountRecipient: row[this.head.registry.accountRecipient.idx],
      //   platform: row[this.head.registry.platform.idx],
      //   service: row[this.head.registry.service.idx],
      //   sender: row[this.head.registry.sender.idx],
      //   recipient: row[this.head.registry.recipient.idx],
      //   coin: row[this.head.registry.coin.idx].toUpperCase(),
      //   coinQty: row[this.head.registry.coinQty.idx],
      //   currency: row[this.head.registry.currency.idx].toUpperCase(),
      //   currencyQty: row[this.head.registry.currencyQty.idx],
      //   currencyPerCoin: row[this.head.registry.currencyPerCoin.idx],
      //   feeCurrency: row[this.head.registry.feeCurrency.idx].toUpperCase(),
      //   feeQty: row[this.head.registry.feeQty.idx],
      //   comment: row[this.head.registry.comment.idx],
      // }
      // const historicalFormatDate = new FormatDate(rowValues.date)
      const accountRecipient = rowValues.accountRecipient
        ? rowValues.accountRecipient
        : rowValues.accountSender;
      const recipient = rowValues.recipient
        ? rowValues.recipient
        : rowValues.sender;
      const senderType =
        contractors[new Hash(rowValues.sender).md5]?.type || 'none';
      const recipientType = contractors[new Hash(recipient).md5]?.type || 'none';
      if (rowValues.date) {
        if (
          ['Transfer', 'Write-off', 'Refill'].indexOf(rowValues.operation) !==
          -1
        ) {
          // const currentCoinKey = new Hash(
          //   currentFormatDate.yyyymmdd + rowValues.coin + 'USD'
          // )
          // const historicalCoinkey = new Hash(
          //   historicalFormatDate.yyyymmdd + rowValues.coin + 'USD'
          // )
          const outPrice = 1;
          // historicalCoinPrice[historicalCoinkey.md5]?.price ||
          // this.getPrevHistoricalPrice(
          //   historicalCoinPrice,
          //   rowValues.date,
          //   rowValues.coin
          // ) ||
          // historicalCoinPrice[currentCoinKey.md5]?.price
          if (['Transfer', 'Write-off'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              account: rowValues.accountSender,
              contractors: rowValues.sender,
              type: senderType,
              coin: rowValues.coin,
              pair: rowValues.coin,
              currencyPerCoin: 1,
              quantity: rowValues.coinQty * -1,
              price: outPrice,
              cost: outPrice * rowValues.coinQty * -1,
            });
          }
          if (['Transfer', 'Refill'].indexOf(rowValues.operation) !== -1) {
            transactionRow.push({
              account: accountRecipient,
              contractors: recipient,
              type: recipientType,
              coin: rowValues.coin,
              pair: rowValues.coin,
              currencyPerCoin: 1,
              quantity: rowValues.coinQty,
              price: outPrice,
              cost: outPrice * rowValues.coinQty,
            });
          }
        } else if (['Buy'].indexOf(rowValues.operation) !== -1) {
          let coinQty = rowValues.coinQty;
          let currencyQty = rowValues.currencyQty;
          if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowValues.currencyPerCoin;
          }
          if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowValues.currencyPerCoin;
          }
          if (rowValues.service === 'Liquidity pool') {
            coinQty /= 2;
          }
          // const currentCoinKey = new Hash(
          //   currentFormatDate.yyyymmdd + rowValues.currency + 'USD'
          // )
          // const historicalCoinkey = new Hash(
          //   historicalFormatDate.yyyymmdd + rowValues.currency + 'USD'
          // )
          const outPrice = 1;
          // historicalCoinPrice[historicalCoinkey.md5]?.price ||
          // this.getPrevHistoricalPrice(
          //   historicalCoinPrice,
          //   rowValues.date,
          //   rowValues.currency
          // ) ||
          // historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowValues.accountSender,
            contractors: rowValues.sender,
            type: senderType,
            coin: rowValues.currency,
            pair: rowValues.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty * -1,
            price: outPrice,
            cost: outPrice * currencyQty * -1,
          });
          const inPrice = (outPrice * currencyQty) / coinQty;
          transactionRow.push({
            account: accountRecipient,
            contractors: recipient,
            type: recipientType,
            coin: rowValues.coin,
            pair: rowValues.currency,
            currencyPerCoin: rowValues.currencyPerCoin
              ? rowValues.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty,
            price: inPrice,
            cost: inPrice * coinQty,
          });
        } else if (['Sell'].indexOf(rowValues.operation) !== -1) {
          let coinQty = rowValues.coinQty;
          let currencyQty = rowValues.currencyQty;
          if (coinQty && rowValues.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowValues.currencyPerCoin;
          }
          if (!coinQty && rowValues.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowValues.currencyPerCoin;
          }
          if (rowValues.service === 'Liquidity pool') {
            coinQty /= 2;
          }
          // const currentCoinKey = new Hash(
          //   currentFormatDate.yyyymmdd + rowValues.coin + 'USD'
          // )
          // const historicalCoinkey = new Hash(
          //   historicalFormatDate.yyyymmdd + rowValues.coin + 'USD'
          // )
          const outPrice = 1;
          // historicalCoinPrice[historicalCoinkey.md5]?.price ||
          // this.getPrevHistoricalPrice(
          //   historicalCoinPrice,
          //   rowValues.date,
          //   rowValues.coin
          // ) ||
          // historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowValues.accountSender,
            contractors: rowValues.sender,
            type: senderType,
            coin: rowValues.coin,
            pair: rowValues.currency,
            currencyPerCoin: rowValues.currencyPerCoin
              ? rowValues.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty * -1,
            price: outPrice,
            cost: outPrice * coinQty * -1,
          });
          const inPrice = (outPrice * coinQty) / currencyQty;
          transactionRow.push({
            account: accountRecipient,
            contractors: recipient,
            type: recipientType,
            coin: rowValues.currency,
            pair: rowValues.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty,
            price: inPrice,
            cost: inPrice * currencyQty,
          });
        }
      }

      transactionRow.forEach((tx) => {
        transaction.push(
          Object.values({
            rowNum: values.rowNum,
            rowHash: values.rowHash,
            date: rowValues.date,
            account: tx.account,
            platform: rowValues.platform,
            service: rowValues.service,
            contractors: tx.contractors,
            type: tx.type,
            coin: tx.coin,
            pair: tx.pair,
            currencyPerCoin: tx.currencyPerCoin,
            price: tx.price,
            quantity: tx.quantity,
            cost: tx.cost,
            comment: rowValues.comment,
          })
        );
      });
    });

    // const historicalCoinPriceArray = Object.values(historicalCoinPrice)
    //   .map((m) => (m = Object.values(m)))
    //   .sort((a, b) => {
    //     return (
    //       new Date(a[this.head.historicalPrice.date.idx]).valueOf() -
    //       new Date(b[this.head.historicalPrice.date.idx]).valueOf()
    //     )
    //   })

    // const lastCoinPrice = historicalCoinPriceArray.reduce((target, source) => {
    //   const row = {
    //     date: new FormatDate(
    //       source[this.head.historicalPrice.date.idx]
    //     ).getFormatDate('yyyy-MM-dd'),
    //     coinKey: new Hash(source[this.head.historicalPrice.symbol.idx])
    //       .md5,
    //     price: source[this.head.historicalPrice.price.idx],
    //   }
    //   if (!target[row.coinKey]) {
    //     target[row.coinKey] = { date: row.date, price: row.price }
    //   }
    //   if (
    //     new Date(target[row.coinKey].date).valueOf() <
    //       new Date(row.date).valueOf() &&
    //     row.price
    //   ) {
    //     target[row.coinKey] = { date: row.date, price: row.price }
    //   }
    //   return target
    // }, {})
    // this.updateCustomPrice(lastCoinPrice)
    // this.updateBalance(transaction, lastCoinPrice, historicalCoinPrice)
    // this.workSheet.portfolio.historicalPrice.insertValues(
    // historicalCoinPriceArray,
    // this.head.getHeaderAlias(this.head.historicalPrice)
    // )
    this.workSheet.insertValues(
      transaction,
      this.head.getHeaderAlias(this.head.transactions)
    );
  }

  getPrevHistoricalPrice(historicalPrices, date, coin) {
    const prevHistoricalPrice = Object.entries(historicalPrices)
      .filter(([rowKey, row]) => {
        return new Hash(row.symbol).md5 === new Hash(coin).md5
      })
      .reduce((lastPrice, [rowKey, row]) => {
        if (
          new FormatDate(row.date).yyyymmdd <= new FormatDate(date).yyyymmdd &&
          row.price
        ) {
          lastPrice = row.price;
        }
        return lastPrice
      }, 0);
    console.log(date, coin, prevHistoricalPrice);
    return prevHistoricalPrice ? prevHistoricalPrice : void 0
  }

  updateCustomPrice(lastHistoricalPrice = { date: '', price: 0 }) {
    const updatedCustomPrice = this.workSheet.portfolio.price.dataValues.map(
      (row) => {
        const lastCoinData =
          lastHistoricalPrice[new Hash(row[this.head.price.symbol.idx]).md5];
        if (
          (!row[this.head.price.price.idx] ||
            new Date(row[this.head.price.lastUpdated.idx]).valueOf() <
              new Date(lastCoinData.date).valueOf()) &&
          !row[this.head.price.source.idx]
        ) {
          row[this.head.price.price.idx] = lastCoinData?.price || 0;
          row[this.head.price.lastUpdated.idx] =
            lastCoinData?.date || new Date();
        }
        return row
      }
    );
    this.workSheet.portfolio.price.insertValues(
      updatedCustomPrice,
      this.head.getHeaderAlias(this.head.price)
    );
  }

  updateBalance(
    transaction = [],
    lastCoinPrice = {},
    historicalCoinPrice = {}
  ) {
    const aggregationValues = transaction.reduce((target, source) => {
      const row = {
        date: new FormatDate(
          source[this.head.transaction.date.idx]
        ).getFormatDate('yyyy-MM-dd'),
        account: source[this.head.transaction.account.idx].toUpperCase(),
        contractors: source[
          this.head.transaction.contractors.idx
        ].toUpperCase(),
        type: source[this.head.transaction.type.idx].toUpperCase(),
        coin: source[this.head.transaction.coin.idx],
        quantity: source[this.head.transaction.quantity.idx],
      };

      if (!target['balance']) {
        target['balance'] = {};
      }
      if (!target['balance'][row.date]) {
        target['balance'][row.date] = {};
      }
      if (!target['balance'][row.date][row.account]) {
        target['balance'][row.date][row.account] = {};
      }
      if (!target['balance'][row.date][row.account][row.contractors]) {
        target['balance'][row.date][row.account][row.contractors] = {};
      }
      if (
        !target['balance'][row.date][row.account][row.contractors][row.type]
      ) {
        target['balance'][row.date][row.account][row.contractors][row.type] = {};
      }
      if (
        !target['balance'][row.date][row.account][row.contractors][row.type][
          row.coin
        ]
      ) {
        target['balance'][row.date][row.account][row.contractors][row.type][
          row.coin
        ] = 0;
      }
      target['balance'][row.date][row.account][row.contractors][row.type][
        row.coin
      ] += row.quantity;

      if (!target['allocation']) {
        target['allocation'] = {};
      }
      if (!target['allocation'][row.account]) {
        target['allocation'][row.account] = {};
      }
      if (!target['allocation'][row.account][row.type]) {
        target['allocation'][row.account][row.type] = {};
      }
      if (!target['allocation'][row.account][row.type][row.coin]) {
        target['allocation'][row.account][row.type][row.coin] = 0;
      }
      target['allocation'][row.account][row.type][row.coin] += row.quantity;

      return target
    }, {});

    const balance = [];
    Object.entries(aggregationValues.balance).forEach(([date, level0]) => {
      const yyyymmdd = new FormatDate(date).yyyymmdd;
      Object.entries(level0).forEach(([account, level1]) => {
        Object.entries(level1).forEach(([contractors, level2]) => {
          Object.entries(level2).forEach(([type, level3]) => {
            Object.entries(level3).forEach(([coin, quantity]) => {
              const currentPrice = lastCoinPrice[new Hash(coin).md5]?.price;
              const historicalPrice =
                historicalCoinPrice[new Hash(yyyymmdd + coin + 'usd').md5]
                  ?.price;
              const currentCost = quantity * currentPrice;
              const historicalCost = quantity * historicalPrice;
              balance.push([
                date,
                account,
                contractors,
                type,
                coin.toUpperCase(),
                quantity,
                historicalCost,
                currentCost,
              ]);
            });
          });
        });
      });
    });

    const allocation = [];
    Object.entries(aggregationValues.allocation).forEach(([account, type]) => {
      Object.entries(type).forEach(([type, coin]) => {
        Object.entries(coin).forEach(([coin, quantity]) => {
          const currentPrice = lastCoinPrice[new Hash(coin).md5]?.price;
          const currentCost = quantity * currentPrice;
          allocation.push([
            account,
            type,
            coin.toUpperCase(),
            quantity,
            currentCost,
          ]);
        });
      });
    });

    this.workSheet.portfolio.balance.insertValues(
      balance,
      this.head.getHeaderAlias(this.head.balance)
    );
    this.workSheet.portfolio.allocation.insertValues(
      allocation,
      this.head.getHeaderAlias(this.head.allocation)
    );
  }
}

// function updateCoinsPrice() {
//   new Coins().updateCoinsPrice()
// }

// function updateCoinsList() {
//   new Coins().updateCoinsList()
// }

function updateTransactions() {
  new Transactions().updateTransactions();
}

function updateUsdPerCurrency(editRange) {
  console.log(new Registry().getFact());
}

// function createInvoiceMenu() {
//   const ui = SpreadsheetApp.getUi()
//   const menu = ui.createMenu('Library')
//   menu.addSubMenu(
//     SpreadsheetApp.getUi()
//       .createMenu('Update')
//       .addItem('Update daily', 'updateDaily')
//       .addItem('Update price', 'updateCoinsPrice')
//       .addItem('Update transaction', 'updateTransactions')
//       .addItem('Update coin list', 'updateCoinsList')
//   )
//   menu.addToUi()
// }
