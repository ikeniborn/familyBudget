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
   *
   * @param {string} apiKey
   */
  constructor(apiKey) {
    this.methods = new Methods({
      domain: 'https://api.cryptorank.io/v1',
      query: { api_key: apiKey },
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
  /**
   * @param {object} instance instance API CryptoRank
   */
  constructor(instance) {
    this.methods = instance.methods;
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
class CoinsList$2 {
  /**
   * @param {object} instance instance API CryptoRank
   */
  constructor(instance) {
    this.methods = instance.methods;
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

class Hash$1 {
  constructor(string) {
    this.string = typeof string === 'string' ? string : string + '';
    this.stringUpperCase = this.string.toUpperCase();
  }

  get md5() {
    let hexstr = '';
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      this.string
        .toLowerCase()
        .toString()
        .replace(/[$+\s+]/g, '_')
        .trim()
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
    return new Hash$1(this.yyyymmdd).md5
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

  addTime(h, m) {
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
  constructor(number) {
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

/**
 * CryptoCompare instance
 */
class Instance$2 {
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
/**
 * CryptoCompare price
 */
class Price$2 {
  /**
   * @param {object} instance instance API CryptoCompare
   */
  constructor(instance) {
    this.methods = instance.methods;
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
    return this.methods.get({
      endPoint: '/pricemulti',
      query: {
        fsyms: fsyms.toUpperCase(),
        tsyms: tsyms.toUpperCase(),
        relaxedValidation: true,
      },
    })
  }

  getMultiFullPrice(fsyms = '', tsyms = 'USD') {
    return this.methods.get({
      endPoint: '/pricemultifull',
      query: {
        fsyms: fsyms.toUpperCase(),
        tsyms: tsyms.toUpperCase(),
        relaxedValidation: true,
      },
    })
  }

  getHistoryPrice(fsym = 'BTC', ts = new Date(), tsyms = 'USD') {
    const dateUnix = new FormatDate(ts).unix;
    return this.methods.get({
      endPoint: '/pricehistorical',
      query: {
        fsym: fsym.toUpperCase(),
        tsyms: tsyms.toUpperCase(),
        ts: dateUnix,
      },
    })
  }
}
/**
 * CryptoCompare coin list
 */
class CoinsList$1 {
  /**
   * @param {object} instance instance API CryptoCompare
   */
  constructor(instance) {
    this.methods = instance.methods;
  }
  getCoinsList() {
    return this.methods.get({ endPoint: '/all/coinlist' })?.Data
  }
}

/**
 * CoinMarketCap instance
 */
class Instance$1 {
  /**
   * Create new inctance API CoinMarketCap
   *s
   * @param {string} apiKey
   */
  constructor(apiKey) {
    this.methods = new Methods({
      domain: 'https://pro-api.coinmarketcap.com',
      data: {
        muteHttpExceptions: true,
        contentType: 'accept: application/json',
        headers: { 'X-CMC_PRO_API_KEY': apiKey },
      },
    });
  }
}
/**
 * CoinMarketCap Price
 */
class Price$1 {
  /**
   * @param {object} instance instance API CoinMarketCap
   */
  constructor(instance) {
    this.methods = instance.methods;
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
class CoinsList {
  /**
   * @param {object} instance instance API CoinMarketCap
   */
  constructor(instance) {
    this.methods = instance.methods;
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
  /**
   * @param {object} instance instance API CoinGecko
   */
  constructor(instance) {
    this.methods = instance.methods;
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
    const currentArea = environment.reduce((area, row) => {
      if (row.scriptId === ScriptApp.getScriptId()) {
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
          // if (!row.excludeSheetName) {
          //   this[ssName].excludeSheetName = []
          // } else {
          //   this[ssName].excludeSheetName = row.excludeSheetName.map((m) =>
          //     m.toLowerCase()
          //   )
          // }
        }
      });
    } else {
      console.error('Check environment!!!');
    }
  }
}

class SpreadSheet {
  constructor(spreadSheetName = '', excludeSheetName = []) {
    const instance = new Environment()[spreadSheetName];
    this.spreadSheet = instance.spreadSheet;
    this.excludeSheetName = excludeSheetName.map((m) => (m = m.toLowerCase()));
  }
}

class WorkSheet {
  constructor(
    spreadSheet = {},
    sheetName = '',
    headerRowNum = 1,
    getRowNum = false,
    getRowHash = false
  ) {
    this.sheetName = sheetName.toLowerCase();
    this.workSheet = spreadSheet.spreadSheet
      .getSheets()
      .filter(
        (f) =>
          f.getName().toLowerCase() === this.sheetName &&
          spreadSheet.excludeSheetName.indexOf(this.sheetName) === -1
      )[0];
    this.getRange(headerRowNum).getValues(getRowNum, getRowHash);
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
    this.countRow = dataRange.getNumRows() - headerRowNum;
    this.countColumn = dataRange.getNumColumns();
    //* формирование заголовка
    this.headerRange = dataRange.offset(
      headerRowNum - 1,
      0,
      1,
      this.countColumn
    );
    this.dataRange =
      this.countRow > 0
        ? dataRange.offset(headerRowNum, 0, this.countRow, this.countColumn)
        : this.headerRange;
    return this
  }

  getValues(getRowNum, getRowHash) {
    this.headerValues = this.headerRange.getValues()[0];
    if (getRowNum && !getRowHash) {
      this.headerValues = ['rowNum', ...this.headerValues];
    } else if (!getRowNum && getRowHash) {
      this.headerValues = ['rowHash', ...this.headerValuesw];
    } else if (getRowNum && getRowHash) {
      this.headerValues = ['rowNum', 'rowHash', ...this.headerValues];
    }
    this.dataObject = [];
    this.dataValues = [];
    this.dataRange.getValues().forEach((row, index) => {
      let rowValues;
      if (getRowNum && !getRowHash) {
        const rowNum = index + this.headerRowNum + 1;
        rowValues = [rowNum, ...row];
      } else if (!getRowNum && getRowHash) {
        rowValues = [new Hash(row.join('#')).md5, ...row];
      } else if (getRowNum && getRowHash) {
        const rowNum = index + this.headerRowNum + 1;
        rowValues = [rowNum, new Hash(row.join('#')).md5, ...row];
      } else {
        rowValues = row;
      }
      const rowObject = rowValues.reduce((keyValue, value, index) => {
        if (!keyValue[this.headerValues[index]]) {
          keyValue[this.headerValues[index]] = value;
        }
        return keyValue
      }, {});
      this.dataValues.push(rowValues);
      this.dataObject.push(rowObject);
    });
    return this
  }

  insertValues(values = [], header = [], firstRow = 1, firstColumn = 1) {
    values.splice(0, 0, header);
    if (values.length) {
      this.deleteFilter();
      this.workSheet
        .clear()
        .getRange(firstRow, firstColumn, values.length, values[0].length)
        .setValues(values);
      this.deleteEmptyRows().deleteEmptyColumns();
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

class Header {
  constructor() {
    /**
     * @param {object} obj list header with alias
     * @returns {{}} return same object with new params: idx, num, name
     */
    function updateProps(obj) {
      return Object.entries(obj).reduce((newcolumn, oldColumn, index) => {
        newcolumn[oldColumn[0]] = Object.entries(oldColumn[1]).reduce(
          (newParams, oldParams) => {
            if (oldParams[0]) {
              newParams[oldParams[0]] = oldParams[1];
            }
            newParams.num = index + 1;
            newParams.idx = index;
            newParams.name = oldColumn[0];
            return newParams
          },
          {}
        );
        return newcolumn
      }, {})
    }
    this.registry = updateProps({
      date: { alias: 'Date' },
      time: { alias: 'Time' },
      operation: { alias: 'Operation' },
      accountSender: { alias: 'Account sender' },
      accountRecipient: { alias: 'Account recipient' },
      platform: { alias: 'Platform' },
      service: { alias: 'Service' },
      sender: { alias: 'Sender' },
      recipient: { alias: 'Recipient' },
      coin: { alias: 'Coin' },
      coinQty: { alias: 'Coin, qty' },
      currency: { alias: 'Currency' },
      currencyQty: { alias: 'Currency, qty' },
      currencyPerCoin: { alias: 'Currency per coin' },
      usdPerCurrency: { alias: 'USD per currency' },
      feeCurrency: { alias: 'Fee currency' },
      feeQty: { alias: 'Fee, qty' },
      comment: { alias: 'Comment' },
    });
    this.price = updateProps({
      name: { alias: 'Name', permanent: true },
      symbol: { alias: 'Symbol', permanent: true },
      risk: { alias: 'Risk', permanent: true },
      price: { alias: 'Price' },
      high24h: { alias: 'High 24h' },
      low24h: { alias: 'Low 24h' },
      percentChange24h: { alias: 'Change 24h, %' },
      percentChange7d: { alias: 'Change 7d, %' },
      percentChange30d: { alias: 'Change 30d, %' },
      percentChange3m: { alias: 'Change 3m, %' },
      percentChange6m: { alias: 'Change 6m, %' },
      volume24h: { alias: 'Volume 24h' },
      rank: { alias: 'Rank' },
      type: { alias: 'Type' },
      category: { alias: 'Category' },
      circulatingSupply: { alias: 'Circulating supply' },
      totalSupply: { alias: 'Total supply' },
      maxSupply: { alias: 'Max supply' },
      marketCap: { alias: 'Market cap' },
      marketCapChange24h: { alias: 'Market cap change 24h' },
      marketCapChangePercentage24h: { alias: 'Market cap change 24h, %' },
      fullyDilutedMarketCap: { alias: 'Fully diluted market cap' },
      ath: { alias: 'All total high (ATH) price' },
      athChangePercentage: { alias: 'ATH change, %' },
      athDate: { alias: 'ATH date' },
      atl: { alias: 'All total low (ATL) price' },
      atlChangePercentage: { alias: 'ATL change, %' },
      atlDate: { alias: 'ATL date' },
      lastUpdated: { alias: 'Last updated' },
      source: { alias: 'Source' },
    });
    this.transaction = updateProps({
      date: { alias: 'Date' },
      account: { alias: 'Account' },
      platform: { alias: 'Platform' },
      service: { alias: 'Service' },
      contractor: { alias: 'Contractor' },
      type: { alias: 'Type' },
      coin: { alias: 'Coin' },
      pair: { alias: 'Pair' },
      currencyPerCoin: { alias: 'Currency per coin' },
      priceUsd: { alias: 'Price, $' },
      quantity: { alias: 'Quantity' },
      cost: { alias: 'Cost, $' },
      comment: { alias: 'Comment' },
    });
    this.balance = updateProps({
      date: { alias: 'Date' },
      account: { alias: 'Account' },
      contractor: { alias: 'Contractor' },
      type: { alias: 'Type' },
      coin: { alias: 'Coin' },
      quantity: { alias: 'Quantity' },
      historicalCost: { alias: 'Historical cost, $' },
      currentCost: { alias: 'Current cost, $' },
    });
    this.allocation = updateProps({
      account: { alias: 'Account' },
      type: { alias: 'Type' },
      coin: { alias: 'Coin' },
      quantity: { alias: 'Quantity' },
      currentCost: { alias: 'Current cost, $' },
    });
    this.historicalPrice = updateProps({
      rowKey: { alias: 'Row key' },
      rowNkey: { alias: 'Row nkey' },
      dateKey: { alias: 'Date key' },
      date: { alias: 'Date' },
      symbol: { alias: 'Symbol' },
      pair: { alias: 'Pair' },
      price: { alias: 'Price' },
    });
    this.coinsList = updateProps({
      rowKey: { alias: 'Row key' },
      rowNkey: { alias: 'Row nkey' },
      source: { alias: 'Source' },
      name: { alias: 'Name' },
      symbol: { alias: 'Symbol' },
      id: { alias: 'Id' },
    });
    this.contractor = updateProps({
      name: { alias: 'Name' },
      type: { alias: 'Type' },
      category: { alias: 'Category' },
    });
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

// const exchangeRatesApiInstance = new exchangeRatesApi.Instance(
//   '3276674210a7471ea773005f04b4a669'
// )
const cryptoRankInstance = new Instance$3(
  'f512dfeb3966b63ac221826ab8501a53d96662a203ad786860d5cc268b85'
);
const cryptoCompareInstance = new Instance$2(
  '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125'
);
const coinMarketCapInstance = new Instance$1(
  '133c18b7-555c-4e57-ad7b-4d2bf6160c20'
);
const coinGeckoInstance = new Instance();

const bscScanKey = 'WBG2AFT4SQ4WKKIAPB4P3Y6BMKDTV1UNZU';

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
    spreadSheetName: 'fundamentalAnalysis',
    sheetId: '1c9Mvwd8KrhUKIs7sPPrSxfKzOdz1Zen6QbOezvVMCao',
    scriptId: '12V0O6ymxbRKl1WP9HiwHwLqEvieD0J45DmRtv-JRKX0darmv97FIaFAP',
    area: 'prod',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1HdeIaXO5WjYOvyv02CgQi3IDpb95YYDt5zYAPLF2IJA',
    scriptId: '1HVxNmr_vVQNl6DS1g1aBscXDTJSmGdHRkxBAzAmqaasvs7y7hnTZvh7y',
    area: 'dev',
  },
  {
    spreadSheetName: 'coingecko',
    sheetId: '1wTTuxXt8n9q7C4NDXqQpI3wpKu1_5bGVmP9Xz0XGSyU',
    scriptId: '1HVxNmr_vVQNl6DS1g1aBscXDTJSmGdHRkxBAzAmqaasvs7y7hnTZvh7y',
    area: 'dev',
  },
  {
    spreadSheetName: 'fundamentalAnalysis',
    sheetId: '1TMpFQVHHk1-FMlq1AbNjqXZ-kamiM5XqVvppcnll62o',
    scriptId: '1aKtMlxaAVvpbzGINbr-oTJvOl1NtklpFr_dmLFVcZIHocTIfNcCeHwWk',
    area: 'dev',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1HdeIaXO5WjYOvyv02CgQi3IDpb95YYDt5zYAPLF2IJA',
    scriptId: '1wMVtZ4j0rNITU7AO7Iw_ShreekQ3bSdKpk-pixV4M1EGRdhNSUCcXmUO',
    area: 'dev',
  },
]);

class Portfolio {
  constructor() {
    this.head = new Header();
    this.coinsData = {};
    this.spreadSheet = {
      portfolio: new SpreadSheet('portfolio'),
      fundamentalanalysis: new SpreadSheet('fundamentalanalysis'),
      coingecko: new SpreadSheet('coingecko'),
    };
    this.workSheet = {
      portfolio: {
        price: new WorkSheet(this.spreadSheet.portfolio, 'prices'),
        registry: new WorkSheet(this.spreadSheet.portfolio, 'registry'),
      },
      fundamentalanalysis: {
        price: new WorkSheet(this.spreadSheet.fundamentalanalysis, 'price'),
      },
    };
  }
}

class Coin extends Portfolio {
  constructor() {
    super();
    this.workSheet.portfolio.coinsList = new WorkSheet(
      this.spreadSheet.portfolio,
      'coins'
    );
  }
  updateCoinPrice() {
    const coinsList = this.workSheet.portfolio.coinsList.dataValues.reduce(
      (list, row) => {
        const rowKey = row[this.head.coinsList.rowKey.idx];
        const id = row[this.head.coinsList.id.idx];
        if (!list[rowKey]) {
          list[rowKey] = id;
        }
        return list
      },
      {}
    );
    const listId = Object.fromEntries(
      Object.entries(
        this.workSheet.portfolio.price.dataValues
          .filter((f) => f[this.head.price.symbol.idx])
          .map(
            (m) =>
              (m = {
                name: m[this.head.price.name.idx],
                symbol: m[this.head.price.symbol.idx],
              })
          )
          .reduce((list, values) => {
            this.workSheet.portfolio.source.dataValues.forEach((source) => {
              if (!list[source]) {
                list[source] = [];
              }
              const rowKey = new Hash$1(
                source + values.name + values.symbol
              ).md5;
              const coinId = coinsList[rowKey];
              if (coinId) {
                list[source].push(coinsList[rowKey]);
              }
            });
            return list
          }, {})
      ).map((m) => (m = [m[0], m[1].join(',')]))
    );

    if (listId.cryptorank) {
      new Price$3(cryptoRankInstance)
        .getLastPrice(listId.cryptorank)
        .forEach((coin) => {
          const coinKey = coin.symbol.toUpperCase();
          if (coin.values.USD.price) {
            this.addCoinsData(coinKey, {
              id: coin.id,
              slug: coin.slug,
              symbol: coin.symbol,
              name: coin.name,
              price: coin.values.USD.price,
              high24h: coin.values.USD.high24h,
              low24h: coin.values.USD.low24h,
              percentChange24h: coin.values.USD.percentChange24h,
              percentChange7d: coin.values.USD.percentChange7d,
              percentChange30d: coin.values.USD.percentChange30d,
              percentChange3m: coin.values.USD.percentChange3m,
              percentChange6m: coin.values.USD.percentChange6m,
              volume24h: coin.values.USD.volume24h,
              rank: coin.rank,
              type: coin.type,
              category: coin.category,
              circulatingSupply: coin.circulatingSupply,
              totalSupply: coin.totalSupply,
              maxSupply: coin.maxSupply,
              marketCap: coin.values.USD.marketCap,
              lastUpdated: new FormatDate(coin.lastUpdated).getFormatDate(
                'yyyy-MM-dd HH:mm'
              ),
              source: 'CryptoRank',
              isNew: true,
            });
          }
        });
    }
    if (listId.coingecko) {
      new Price(coinGeckoInstance)
        .getMarketsPrice(listId.coingecko)
        .forEach((coin) => {
          const coinKey = coin.symbol.toUpperCase();
          if (coin.current_price) {
            this.addCoinsData(coinKey, {
              id: coin.id,
              slug: coin.id,
              symbol: coin.symbol,
              name: coin.name,
              price: coin.current_price,
              high24h: coin.high_24h,
              low24h: coin.low_24h,
              percentChange24h: coin.price_change_percentage_24h_in_currency,
              percentChange7d: coin.price_change_percentage_7d_in_currency,
              percentChange30d: coin.price_change_percentage_30d_in_currency,
              volume24h: coin.total_volume,
              rank: coin.market_cap_rank,
              type: coin.type,
              marketCap: coin.market_cap,
              marketCapChange24h: coin.market_cap_change_24h,
              marketCapChangePercentage24h:
                coin.market_cap_change_percentage_24h,
              maxSupply: coin.max_supply,
              circulatingSupply: coin.circulating_supply,
              totalSupply: coin.total_supply,
              fullyDilutedMarketCap: coin.fully_diluted_valuation,
              ath: coin.ath,
              athChangePercentage: coin.ath_change_percentage,
              athDate: new FormatDate(coin.ath_date).getFormatDate(
                'yyyy-MM-dd HH:mm'
              ),
              atl: coin.atl,
              atlChangePercentage: coin.atl_change_percentage,
              atlDate: new FormatDate(coin.atl_date).getFormatDate(
                'yyyy-MM-dd HH:mm'
              ),
              lastUpdated: new FormatDate(
                coin.last_updated
              ).getFormatDate('yyyy-MM-dd HH:mm'),
              source: 'CoinGecko',
              isNew: true,
            });
          }
        });
    }
    if (listId.coinmarketcap) {
      Object.values(
        new Price$1(coinMarketCapInstance).getLastPrice(
          listId.coinmarketcap
        )
      ).forEach((coin) => {
        const coinKey = coin.symbol.toUpperCase();
        if (coin.quote.USD.price) {
          this.addCoinsData(coinKey, {
            id: coin.id,
            slug: coin.slug,
            symbol: coin.symbol,
            name: coin.name,
            dateAdded: coin.date_added,
            rank: coin.cmc_rank,
            maxSupply: coin.max_supply,
            circulatingSupply: coin.circulating_supply,
            totalSupply: coin.total_supply,
            price: coin.quote.USD.price,
            volume24h: coin.quote.USD.volume_24h,
            volumeChange24h: coin.quote.USD.volume_change_24h,
            marketCap: coin.quote.USD.market_cap,
            percentChange24h: coin.quote.USD.percent_change_24h,
            percentChange7d: coin.quote.USD.percent_change_7d,
            percentChange30d: coin.quote.USD.percent_change_30d,
            marketCapDominance: coin.quote.USD.market_cap_dominance,
            fullyDilutedMarketCap: coin.quote.USD.fully_diluted_market_cap,
            lastUpdated: new FormatDate(coin.last_updated).getFormatDate(
              'yyyy-MM-dd HH:mm'
            ),
            source: 'CoinMarketCap',
            isNew: true,
          });
        }
      });
    }
    if (listId.cryptocompare) {
      Object.entries(
        new Price$2(cryptoCompareInstance).getMultiPrice(
          listId.cryptocompare
        )
      ).forEach((coin) => {
        const coinKey = coin[0].toUpperCase();
        if (coin[1].USD) {
          this.addCoinsData(coinKey, {
            symbol: coin[0],
            price: coin[1].USD,
            source: 'Cryptocompare',
            lastUpdated: new FormatDate().getFormatDate(
              'yyyy-MM-dd HH:mm'
            ),
            isNew: true,
          });
        }
      });
    }

    const priceArray = this.workSheet.portfolio.price.dataValues.reduce(
      (coins, row) => {
        const coin = {};
        const coinSymbol = row[this.head.price.symbol.idx].toUpperCase();
        Object.values(this.head.price).forEach((head) => {
          if (head.permanent) {
            coin[head.name] = row[head.idx];
          } else {
            if (this.coinsData[coinSymbol]) {
              coin[head.name] = this.coinsData[coinSymbol][head.name];
            } else {
              coin[head.name] = row[head.idx];
            }
          }
        });
        coins.push(Object.values(coin));
        return coins
      },
      []
    );
    this.workSheet.portfolio.price.insertValues(
      priceArray,
      this.head.getHeaderAlias(this.head.price)
    );

    this.workSheet.fundamentalanalysis.price.insertValues(
      priceArray,
      this.head.getHeaderAlias(this.head.price)
    );
  }

  updateCoinsList() {
    this.workSheet.coingecko.coingeckoTokenApiList = new WorkSheet(
      this.spreadSheet.coingecko,
      'coingecko token api list'
    );
    const coinsList = [];
    // new coinGecko.CoinsList(coinGeckoInstance)
    //   .getCoinsList()
    //   .forEach((coin) => {
    //     let rowHash = new utils.Hash('coingecko' + coin.symbol).md5
    //     coinsList.push([rowHash, 'coingecko', coin.name, coin.symbol, coin.id])
    //   })
    this.workSheet.coingecko
      .coingeckoTokenApiList()
      .dataValues.forEach((coin) => {
        const key = new Hash$1('coingecko' + coin[2] + coin[1]);
        coinsList.push([
          key.md5,
          key.string,
          'coingecko',
          coin[2],
          coin[1],
          coin[0],
        ]);
      });
    new CoinsList$2(cryptoRankInstance)
      .getCoinsList(15000)
      .forEach((coin) => {
        const key = new Hash$1('cryptorank' + coin.name + coin.symbol);
        coinsList.push([
          key.md5,
          key.string,
          'cryptorank',
          coin.name,
          coin.symbol,
          coin.id,
        ]);
      });
    new CoinsList(coinMarketCapInstance)
      .getCoinsList()
      .forEach((coin) => {
        const key = new Hash$1('coinmarketcap' + coin.name + coin.symbol);
        coinsList.push([
          key.md5,
          key.string,
          'coinmarketcap',
          coin.name,
          coin.symbol,
          coin.id,
        ]);
      });

    Object.entries(
      new CoinsList$1(cryptoCompareInstance).getCoinsList()
    ).forEach((coin) => {
      const key = new Hash$1('cryptocompare' + coin[1].CoinName + coin[0]);
      coinsList.push([
        key.md5,
        key.string,
        'cryptocompare',
        coin[1].CoinName,
        coin[1].Symbol,
        coin[0],
      ]);
    });
    const currency = [
      ['USA dollar', 'USD'],
      ['Russian rubble', 'RUB'],
      ['Euro', 'EUR'],
    ];
    currency.forEach((coin) => {
      const key = new Hash$1('cryptocompare' + coin[0] + coin[1]);
      coinsList.push([
        key.md5,
        key.string,
        'cryptocompare',
        coin[0],
        coin[1],
        coin[1],
      ]);
    });
    this.workSheet.portfolio.coinsList.insertValues(
      coinsList,
      this.head.getHeaderAlias(this.head.coinsList)
    );
  }
}

class Transaction extends Portfolio {
  constructor() {
    super();
    this.workSheet.allocation = new WorkSheet(
      this.spreadSheet.portfolio,
      'allocation'
    );
    this.workSheet.source = new WorkSheet(
      this.spreadSheet.portfolio,
      'sources'
    );
    this.workSheet.historicalPrice = new WorkSheet(
      this.spreadSheet.portfolio,
      'historicalprices'
    );
    this.workSheet.transaction = new WorkSheet(
      this.spreadSheet.portfolio,
      'transactions'
    );
    this.workSheet.balance = new WorkSheet(
      this.spreadSheet.portfolio,
      'balance'
    );
    this.workSheet.constractor = new WorkSheet(
      this.spreadSheet.portfolio,
      'contractors'
    );
  }

  addCoinsData(coinKey, data) {
    if (!this.coinsData[coinKey]) {
      this.coinsData[coinKey] = data;
    } else {
      Object.entries(data).forEach((column) => {
        const head = column[0];
        const value = column[1];
        if (!this.coinsData[coinKey][head]) {
          this.coinsData[coinKey][head] = value;
        }
      });
    }
  }

  updateTransactions() {
    const currentFormatDate = new FormatDate();
    const transaction = [];
    const contractor = this.workSheet.portfolio.constractor.dataValues.reduce(
      (dim, row) => {
        const type = row[this.head.contractor.type.idx];
        const name = new Hash$1(row[this.head.contractor.name.idx]);
        if (!dim[name.md5]) {
          dim[name.md5] = {
            name: name.stringUpperCase,
            type: type,
          };
        }
        return dim
      },
      {}
    );
    const currentCoinPrice = this.workSheet.portfolio.price.dataValues.reduce(
      (list, row) => {
        const key = new Hash$1(
          currentFormatDate.yyyymmdd + row[this.head.price.symbol.idx] + 'USD'
        );
        if (row[this.head.price.price.idx]) {
          list[key.md5] = {
            rowKey: key.md5,
            rowNkey: key.stringUpperCase,
            dateKey: currentFormatDate.md5,
            date: currentFormatDate.getFormatDate('yyyy-MM-dd'),
            symbol: row[this.head.price.symbol.idx].toUpperCase(),
            pair: 'USD',
            price: row[this.head.price.price.idx],
          };
        }
        return list
      },
      {}
    );

    const historicalCoinPrice = this.workSheet.portfolio.historicalPrice.dataValues.reduce(
      (list, row) => {
        const rowKey = row[this.head.historicalPrice.rowKey.idx];
        if (!list[rowKey]) {
          list[rowKey] = {
            rowKey: row[this.head.historicalPrice.rowKey.idx],
            rowNkey: row[this.head.historicalPrice.rowNkey.idx],
            dateKey: row[this.head.historicalPrice.dateKey.idx],
            date: row[this.head.historicalPrice.date.idx],
            symbol: row[this.head.historicalPrice.symbol.idx],
            pair: row[this.head.historicalPrice.pair.idx],
            price: row[this.head.historicalPrice.price.idx],
          };
        }
        return list
      },
      currentCoinPrice
    );

    this.workSheet.portfolio.registry.dataValues.forEach((row) => {
      const transactionRow = [];
      const rowData = {
        date: row[this.head.account.date.idx],
        time: row[this.head.account.time.idx],
        operation: row[this.head.account.operation.idx],
        accountSender: row[this.head.account.accountSender.idx],
        accountRecipient: row[this.head.account.accountRecipient.idx],
        platform: row[this.head.account.platform.idx],
        service: row[this.head.account.service.idx],
        sender: row[this.head.account.sender.idx],
        recipient: row[this.head.account.recipient.idx],
        coin: row[this.head.account.coin.idx].toUpperCase(),
        coinQty: row[this.head.account.coinQty.idx],
        currency: row[this.head.account.currency.idx].toUpperCase(),
        currencyQty: row[this.head.account.currencyQty.idx],
        currencyPerCoin: row[this.head.account.currencyPerCoin.idx],
        feeCurrency: row[this.head.account.feeCurrency.idx].toUpperCase(),
        feeQty: row[this.head.account.feeQty.idx],
        comment: row[this.head.account.comment.idx],
      };
      const historicalFormatDate = new FormatDate(rowData.date);
      const accountRecipient = rowData.accountRecipient
        ? rowData.accountRecipient
        : rowData.accountSender;
      const recipient = rowData.recipient ? rowData.recipient : rowData.sender;
      const senderType =
        contractor[new Hash$1(rowData.sender).md5]?.type || 'none';
      const recipientType =
        contractor[new Hash$1(recipient).md5]?.type || 'none';
      if (rowData.date) {
        if (
          ['Transfer', 'Write-off', 'Refill'].indexOf(rowData.operation) !== -1
        ) {
          const currentCoinKey = new Hash$1(
            currentFormatDate.yyyymmdd + rowData.coin + 'USD'
          );
          const historicalCoinkey = new Hash$1(
            historicalFormatDate.yyyymmdd + rowData.coin + 'USD'
          );
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            this.getPrevHistoricalPrice(
              historicalCoinPrice,
              rowData.date,
              rowData.coin
            ) ||
            historicalCoinPrice[currentCoinKey.md5]?.price;
          if (['Transfer', 'Write-off'].indexOf(rowData.operation) !== -1) {
            transactionRow.push({
              account: rowData.accountSender,
              contractor: rowData.sender,
              type: senderType,
              coin: rowData.coin,
              pair: rowData.coin,
              currencyPerCoin: 1,
              quantity: rowData.coinQty * -1,
              price: outPrice,
              cost: outPrice * rowData.coinQty * -1,
            });
          }
          if (['Transfer', 'Refill'].indexOf(rowData.operation) !== -1) {
            transactionRow.push({
              account: accountRecipient,
              contractor: recipient,
              type: recipientType,
              coin: rowData.coin,
              pair: rowData.coin,
              currencyPerCoin: 1,
              quantity: rowData.coinQty,
              price: outPrice,
              cost: outPrice * rowData.coinQty,
            });
          }
        } else if (['Buy'].indexOf(rowData.operation) !== -1) {
          let coinQty = rowData.coinQty;
          let currencyQty = rowData.currencyQty;
          if (coinQty && rowData.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowData.currencyPerCoin;
          }
          if (!coinQty && rowData.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowData.currencyPerCoin;
          }
          if (rowData.service === 'Liquidity pool') {
            coinQty /= 2;
          }
          const currentCoinKey = new Hash$1(
            currentFormatDate.yyyymmdd + rowData.currency + 'USD'
          );
          const historicalCoinkey = new Hash$1(
            historicalFormatDate.yyyymmdd + rowData.currency + 'USD'
          );
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            this.getPrevHistoricalPrice(
              historicalCoinPrice,
              rowData.date,
              rowData.currency
            ) ||
            historicalCoinPrice[currentCoinKey.md5]?.price;
          transactionRow.push({
            account: rowData.accountSender,
            contractor: rowData.sender,
            type: senderType,
            coin: rowData.currency,
            pair: rowData.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty * -1,
            price: outPrice,
            cost: outPrice * currencyQty * -1,
          });
          const inPrice = (outPrice * currencyQty) / coinQty;
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            type: recipientType,
            coin: rowData.coin,
            pair: rowData.currency,
            currencyPerCoin: rowData.currencyPerCoin
              ? rowData.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty,
            price: inPrice,
            cost: inPrice * coinQty,
          });
        } else if (['Sell'].indexOf(rowData.operation) !== -1) {
          let coinQty = rowData.coinQty;
          let currencyQty = rowData.currencyQty;
          if (coinQty && rowData.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowData.currencyPerCoin;
          }
          if (!coinQty && rowData.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowData.currencyPerCoin;
          }
          if (rowData.service === 'Liquidity pool') {
            coinQty /= 2;
          }
          const currentCoinKey = new Hash$1(
            currentFormatDate.yyyymmdd + rowData.coin + 'USD'
          );
          const historicalCoinkey = new Hash$1(
            historicalFormatDate.yyyymmdd + rowData.coin + 'USD'
          );
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            this.getPrevHistoricalPrice(
              historicalCoinPrice,
              rowData.date,
              rowData.coin
            ) ||
            historicalCoinPrice[currentCoinKey.md5]?.price;
          transactionRow.push({
            account: rowData.accountSender,
            contractor: rowData.sender,
            type: senderType,
            coin: rowData.coin,
            pair: rowData.currency,
            currencyPerCoin: rowData.currencyPerCoin
              ? rowData.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty * -1,
            price: outPrice,
            cost: outPrice * coinQty * -1,
          });
          const inPrice = (outPrice * coinQty) / currencyQty;
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            type: recipientType,
            coin: rowData.currency,
            pair: rowData.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty,
            price: inPrice,
            cost: inPrice * currencyQty,
          });
        }
      }

      transactionRow.forEach((tx) => {
        const coinKey = new Hash$1(
          historicalFormatDate.yyyymmdd + tx.coin + 'USD'
        );
        if (typeof tx.price === 'number') {
          historicalCoinPrice[coinKey.md5] = {
            rowKey: coinKey.md5,
            rowNkey: coinKey.stringUpperCase,
            dateKey: historicalFormatDate.md5,
            date: historicalFormatDate.getFormatDate('yyyy-MM-dd'),
            symbol: tx.coin,
            pair: 'USD',
            price: tx.price,
          };
        }

        transaction.push(
          Object.values({
            date: rowData.date,
            account: tx.account,
            platform: rowData.platform,
            service: rowData.service,
            contractor: tx.contractor,
            type: tx.type,
            coin: tx.coin,
            pair: tx.pair,
            currencyPerCoin: tx.currencyPerCoin,
            price: tx.price,
            quantity: tx.quantity,
            cost: tx.cost,
            comment: rowData.comment,
          })
        );
      });
    });

    const historicalCoinPriceArray = Object.values(historicalCoinPrice)
      .map((m) => (m = Object.values(m)))
      .sort((a, b) => {
        return (
          new Date(a[this.head.historicalPrice.date.idx]).valueOf() -
          new Date(b[this.head.historicalPrice.date.idx]).valueOf()
        )
      });

    const lastCoinPrice = historicalCoinPriceArray.reduce((target, source) => {
      const row = {
        date: new FormatDate(
          source[this.head.historicalPrice.date.idx]
        ).getFormatDate('yyyy-MM-dd'),
        coinKey: new Hash$1(source[this.head.historicalPrice.symbol.idx])
          .md5,
        price: source[this.head.historicalPrice.price.idx],
      };
      if (!target[row.coinKey]) {
        target[row.coinKey] = { date: row.date, price: row.price };
      }
      if (
        new Date(target[row.coinKey].date).valueOf() <
          new Date(row.date).valueOf() &&
        row.price
      ) {
        target[row.coinKey] = { date: row.date, price: row.price };
      }
      return target
    }, {});
    this.updateCustomPrice(lastCoinPrice);
    this.updateBalance(transaction, lastCoinPrice, historicalCoinPrice);
    this.workSheet.portfolio.historicalPrice.insertValues(
      historicalCoinPriceArray,
      this.head.getHeaderAlias(this.head.historicalPrice)
    );

    this.workSheet.portfolio.transaction.insertValues(
      transaction,
      this.head.getHeaderAlias(this.head.transaction)
    );
  }

  getPrevHistoricalPrice(historicalPrices, date, coin) {
    const prevHistoricalPrice = Object.entries(historicalPrices)
      .filter(([rowKey, row]) => {
        return new Hash$1(row.symbol).md5 === new Hash$1(coin).md5
      })
      .reduce((lastPrice, [rowKey, row]) => {
        if (
          new FormatDate(row.date).yyyymmdd <=
            new FormatDate(date).yyyymmdd &&
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
          lastHistoricalPrice[
            new Hash$1(row[this.head.price.symbol.idx]).md5
          ];
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
        contractor: source[this.head.transaction.contractor.idx].toUpperCase(),
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
      if (!target['balance'][row.date][row.account][row.contractor]) {
        target['balance'][row.date][row.account][row.contractor] = {};
      }
      if (!target['balance'][row.date][row.account][row.contractor][row.type]) {
        target['balance'][row.date][row.account][row.contractor][row.type] = {};
      }
      if (
        !target['balance'][row.date][row.account][row.contractor][row.type][
          row.coin
        ]
      ) {
        target['balance'][row.date][row.account][row.contractor][row.type][
          row.coin
        ] = 0;
      }
      target['balance'][row.date][row.account][row.contractor][row.type][
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
        Object.entries(level1).forEach(([contractor, level2]) => {
          Object.entries(level2).forEach(([type, level3]) => {
            Object.entries(level3).forEach(([coin, quantity]) => {
              const currentPrice =
                lastCoinPrice[new Hash$1(coin).md5]?.price;
              const historicalPrice =
                historicalCoinPrice[new Hash$1(yyyymmdd + coin + 'usd').md5]
                  ?.price;
              const currentCost = quantity * currentPrice;
              const historicalCost = quantity * historicalPrice;
              balance.push([
                date,
                account,
                contractor,
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
          const currentPrice = lastCoinPrice[new Hash$1(coin).md5]?.price;
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

class Registry extends Portfolio {
  constructor() {
    super();
  }
  updateUsdPerCurrency(editRange) {
    this.eMap = new Map(Object.entries(editRange));
    if (this.eMap.has('range')) {
      if (
        this.eMap.get('range').columnStart === this.head.registry.currency.num
      ) {
        const rowNum = this.eMap.get('range').rowStart;
        const rowIndex = rowNum - 2;
        const rowValues = this.workSheet.portfolio.registry.dataValues.filter(
          (row, index) => index === rowIndex
        )[0];
        const currency = rowValues[this.head.registry.currency.idx];
        const time = new FormatNumber(
          rowValues[this.head.registry.time.idx]
        ).getHourAndMinuteFromNumber();
        const dateTime = new FormatDate(
          rowValues[this.head.registry.date.idx]
        ).addTime(time.h, time.m).date;
        const price = new Price$2(
          cryptoCompareInstance
        ).getHistoryPrice(currency, dateTime)[currency.toUpperCase()].USD;
        this.workSheet.portfolio.registry.insertValue(
          price,
          rowNum,
          this.head.registry.usdPerCurrency.num
        );
      }
    }
  }
}

function updateCoinsPrice() {
  new Coin().updateCoinsPrice();
}

function updateCoinsList() {
  new Coin().updateCoinsList();
}

function updateTransactions() {
  new Transaction().updateTransactions();
}

function updateUsdPerCurrency(editRange) {
  new Registry().updateUsdPerCurrency(editRange);
}
