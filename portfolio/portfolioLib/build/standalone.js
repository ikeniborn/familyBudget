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
    this.url = this.domain + variableParams?.endPoint;
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
    this.result;
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
          this.code = response.getResponseCode();
          if (code === 200) {
            this.result = JSON.parse(response.getContentText());
            this.fetchStatus = true;
            resolve();
          }
          reject();
        })
      };
      const timeOutPromise = (ms) => {
        return new Promise((resolve) => {
          console.log('URL: ' + this.url);
          console.log('Response code: ' + this.code);
          console.log('Start timeout: ' + ms / 1000 + ' sec');
          Utilities.sleep(ms);
          resolve();
        })
      };
      let ms = 2000;
      let iteration = 0;
      do {
        fetchPromise().catch(timeOutPromise(ms));
        ms += 250;
        iteration += 1;
      } while (!this.fetchStatus || iteration <= 5)

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
        fsym: fsym,
        tsyms: tsyms,
        relaxedValidation: true,
      },
    })
  }

  getMultiPrice(fsyms = '', tsyms = 'USD') {
    return this.methods.get({
      endPoint: '/pricemulti',
      query: {
        fsyms: fsyms,
        tsyms: tsyms,
        relaxedValidation: true,
      },
    })
  }

  getMultiFullPrice(fsyms = '', tsyms = 'USD') {
    return this.methods.get({
      endPoint: '/pricemultifull',
      query: {
        fsyms: fsyms,
        tsyms: tsyms,
        relaxedValidation: true,
      },
    })
  }

  getHistoryPrice(fsym = '', ts = '', tsyms = 'USD') {
    !ts
      ? (ts = new Date().valueOf() / 1000)
      : (ts = new Date(ts).valueOf() / 1000);
    return this.methods.get({
      endPoint: '/pricehistorical',
      query: {
        fsym: fsym,
        tsyms: tsyms,
        ts: ts,
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

class GasEnvironment {
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
    if (GasEnvironment.exists) {
      return GasEnvironment.instance
    }
    GasEnvironment.instance = this;
    GasEnvironment.exists = true;
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

class GasSpreadSheet {
  constructor(spreadSheetName = '', excludeSheetName = []) {
    const instance = new GasEnvironment()[spreadSheetName];
    this.spreadSheet = instance.spreadSheet;
    this.excludeSheetName = excludeSheetName.map((m) => (m = m.toLowerCase()));
  }
}

class GasWorkSheet extends GasSpreadSheet {
  constructor(
    spreadSheetName = '',
    sheetName = '',
    headerRowNum = 1,
    getRowNum = false,
    getRowHash = false
  ) {
    super(spreadSheetName);
    this.sheetName = sheetName.toLowerCase();
    this.workSheet = this.spreadSheet
      .getSheets()
      .filter(
        (f) =>
          f.getName().toLowerCase() === this.sheetName &&
          this.excludeSheetName.indexOf(this.sheetName) === -1
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
      this.headerValues = ['hashKey', ...this.headerValuesw];
    } else if (getRowNum && getRowHash) {
      this.headerValues = ['rowNum', 'hashKey', ...this.headerValues];
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

  insertValues(values, firstRow = 1, firstColumn = 1) {
    this.workSheet
      .clear()
      .getRange(firstRow, firstColumn, values.length, values[0].length)
      .setValues(values);
    return this
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

class Hash$1 {
  constructor(string) {
    this.string = typeof string === 'string' ? string : string + '';
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
    this.account = updateProps({
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
      feeCurrency: { alias: 'Fee currency' },
      feeQty: { alias: 'Fee, qty' },
      comment: { alias: 'Comment' },
    });
    this.price = updateProps({
      name: { alias: 'Name', permanent: true },
      symbol: { alias: 'Symbol', permanent: true },
      customPrice: { alias: 'Custom price', permanent: true },
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
      coin: { alias: 'Coin' },
      pair: { alias: 'Pair' },
      price: { alias: 'Price' },
      quantity: { alias: 'Quantity' },
      historicalCost: { alias: 'Historical cost' },
      currentCost: { alias: 'Current cost' },
      comment: { alias: 'Comment' },
    });
    this.balance = updateProps({
      date: { alias: 'Date' },
      account: { alias: 'Account' },
      contractor: { alias: 'Contractor' },
      coin: { alias: 'Coin' },
      quantity: { alias: 'Quantity' },
    });
    this.historicalPrice = updateProps({
      rowKey: { alias: 'Row key' },
      rownNkey: { alias: 'Row nkey' },
      dateKey: { alias: 'Date key' },
      date: { alias: 'Date' },
      symbol: { alias: 'Symbol' },
      pair: { alias: 'Pair' },
      price: { alias: 'Price' },
    });
    this.coinList = updateProps({
      rowKey: { alias: 'Row key' },
      rowNkey: { alias: 'Row nkey' },
      source: { alias: 'Source' },
      name: { alias: 'Name' },
      symbol: { alias: 'Symbol' },
      id: { alias: 'Id' },
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

new GasEnvironment([
  {
    spreadSheetName: 'portfolio',
    sheetId: '1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg',
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
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
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
]);

class Portfolio {
  constructor() {
    this.head = new Header();
    this.coinsData = {};
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
  updateCoinPrice() {
    const portfolioPrice = new GasWorkSheet('portfolio', 'price');
    const portfolioCoinList = new GasWorkSheet('portfolio', 'coinlist');
    const portfolioSource = new GasWorkSheet('portfolio', 'source');
    const fundamentalAnalysis = new GasWorkSheet(
      'fundamentalanalysis',
      'price'
    );
    const coinList = portfolioCoinList.dataValues.reduce((list, row) => {
      const rowKey = row[this.head.coinList.rowKey.idx];
      const id = row[this.head.coinList.id.idx];
      if (!list[rowKey]) {
        list[rowKey] = id;
      }
      return list
    }, {});
    const listId = Object.fromEntries(
      Object.entries(
        portfolioPrice.dataValues
          .filter((f) => f[this.head.price.symbol.idx])
          .map(
            (m) =>
              (m = {
                name: m[this.head.price.name.idx],
                symbol: m[this.head.price.symbol.idx],
                customPrice: m[this.head.price.customPrice.idx],
              })
          )
          .reduce((list, values) => {
            portfolioSource.dataValues.forEach((source) => {
              if (!list[source]) {
                list[source] = [];
              }
              const rowKey = new Hash$1(
                source + values.name + values.symbol
              ).md5;
              const coinId = coinList[rowKey];
              if (coinId && !values.customPrice) {
                list[source].push(coinList[rowKey]);
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
        });
    }
    if (listId.coingecko) {
      new Price(coinGeckoInstance)
        .getMarketsPrice(listId.coingecko)
        .forEach((coin) => {
          const coinKey = coin.symbol.toUpperCase();
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
            marketCapChangePercentage24h: coin.market_cap_change_percentage_24h,
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
            lastUpdated: new FormatDate(coin.last_updated).getFormatDate(
              'yyyy-MM-dd HH:mm'
            ),
            source: 'CoinGecko',
            isNew: true,
          });
        });
    }
    if (listId.coinmarketcap) {
      Object.values(
        new Price$1(coinMarketCapInstance).getLastPrice(
          listId.coinmarketcap
        )
      ).forEach((coin) => {
        const coinKey = coin.symbol.toUpperCase();
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
      });
    }
    if (listId.cryptocompare) {
      Object.entries(
        new Price$2(cryptoCompareInstance).getMultiPrice(
          listId.cryptocompare
        )
      ).forEach((coin) => {
        const coinKey = coin[0].toUpperCase();
        this.addCoinsData(coinKey, {
          symbol: coin[0],
          price: coin[1].USD,
          source: 'Cryptocompare',
          lastUpdated: new FormatDate().getFormatDate('yyyy-MM-dd HH:mm'),
          isNew: true,
        });
      });
    }

    const priceArray = portfolioPrice.dataValues.reduce(
      (coins, row) => {
        const coin = {};
        const coinSymbol = row[1].toUpperCase();
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
      [this.head.getHeaderAlias(this.head.price)]
    );
    this.updateHistoricalPrice(priceArray);
    portfolioPrice
      .deleteFilter()
      .insertValues(priceArray)
      .deleteEmptyRows()
      .deleteEmptyColumns();
    fundamentalAnalysis
      .deleteFilter()
      .insertValues(priceArray)
      .deleteEmptyRows()
      .deleteEmptyColumns();
  }

  updateHistoricalPrice(array = []) {
    const portfolioHistoricalPrice = new GasWorkSheet(
      'portfolio',
      'historicalprice'
    );
    const newDate = new FormatDate(new Date());
    const yyyymmdd = newDate.yyyymmdd;
    const dateKey = new Hash$1(yyyymmdd).md5;
    const formatDate = newDate.getFormatDate('yyyy-MM-dd');
    const pair = 'USD';
    const historicalPrice = portfolioHistoricalPrice.dataValues.filter(
      (row) => {
        return row[this.head.historicalPrice.dateKey.idx] !== dateKey
      }
    );

    historicalPrice.splice(
      0,
      0,
      this.head.getHeaderAlias(this.head.historicalPrice)
    );

    array.slice(1).forEach((row) => {
      const symbol = row[this.head.price.symbol.idx].toUpperCase();
      const price = row[this.head.price.price.idx];
      const key = new Hash$1(yyyymmdd + symbol + pair);
      const rowKey = key.md5;
      const rowNkey = key.string;
      historicalPrice.push([
        rowKey,
        rowNkey,
        dateKey,
        formatDate,
        symbol,
        pair,
        price,
      ]);
    });
    portfolioHistoricalPrice
      .deleteFilter()
      .insertValues(historicalPrice)
      .deleteEmptyRows();
  }

  updateHistoricalPriceKey() {
    const portfolioHistoricalPrice = new GasWorkSheet(
      'portfolio',
      'historicalprice'
    );
    const newDate = new FormatDate(new Date());
    const yyyymmdd = newDate.yyyymmdd;
    const dateKey = new Hash$1(yyyymmdd).md5;
    const formatDate = newDate.getFormatDate('yyyy-MM-dd');
    const pair = 'USD';
    const historicalPrice = portfolioHistoricalPrice.dataValues.reduce(
      (newArray, oldArray) => {
        const date = new FormatDate(
          oldArray[this.head.historicalPrice.date.idx]
        );
        const dateKey = new Hash$1(date.yyyymmdd).md5;
        const symbol = oldArray[
          this.head.historicalPrice.symbol.idx
        ].toUpperCase();
        const pair = oldArray[this.head.historicalPrice.pair.idx].toUpperCase();
        const price = oldArray[this.head.historicalPrice.price.idx];
        const key = new Hash$1(date.yyyymmdd + symbol + pair);
        newArray.push([
          key.md5,
          key.string,
          dateKey,
          date.getFormatDate('yyyy-MM-dd'),
          symbol,
          pair,
          price,
        ]);
        return newArray
      },
      [this.head.getHeaderAlias(this.head.historicalPrice)]
    );
    portfolioHistoricalPrice
      .deleteFilter()
      .insertValues(historicalPrice)
      .deleteEmptyRows();
  }

  updateCoinList() {
    const portfolioCoinList = new GasWorkSheet('portfolio', 'coinlist');
    const coinGeckoCoinList = new GasWorkSheet(
      'coingecko',
      'coingecko token api list'
    );
    const coinList = [this.head.getHeaderAlias(this.head.coinList)];
    // new coinGecko.CoinsList(coinGeckoInstance)
    //   .getCoinsList()
    //   .forEach((coin) => {
    //     let rowHash = new utils.Hash('coingecko' + coin.symbol).md5
    //     coinList.push([rowHash, 'coingecko', coin.name, coin.symbol, coin.id])
    //   })
    coinGeckoCoinList.dataValues.forEach((coin) => {
      const key = new Hash$1('coingecko' + coin[2] + coin[1]);
      coinList.push([
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
        coinList.push([
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
        coinList.push([
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
      coinList.push([
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
      coinList.push([
        key.md5,
        key.string,
        'cryptocompare',
        coin[0],
        coin[1],
        coin[1],
      ]);
    });
    portfolioCoinList.deleteFilter().insertValues(coinList).deleteEmptyRows();
  }

  updateTransaction() {
    const portfolioAccount = new GasWorkSheet('portfolio', 'account');
    const portfolioPrice = new GasWorkSheet('portfolio', 'price');
    const portfolioTransaction = new GasWorkSheet(
      'portfolio',
      'transaction'
    );
    const portfolioHistoricalPrice = new GasWorkSheet(
      'portfolio',
      'historicalprice'
    );
    const coinPriceList = portfolioPrice.dataValues.reduce((list, row) => {
      const rowKey = new Hash$1(row[this.head.price.symbol.idx]).md5;
      if (!list[rowKey]) {
        list[rowKey] = row[this.head.price.price.idx];
      }
      return list
    }, {});
    const historicalCoinPriceList = portfolioHistoricalPrice.dataValues.reduce(
      (list, row) => {
        const rowKey = row[this.head.historicalPrice.rowKey.idx];
        if (!list[rowKey]) {
          list[rowKey] = row[this.head.historicalPrice.price.idx];
        }
        return list
      },
      {}
    );

    const dataSet = portfolioAccount.dataValues.reduce(
      (array, row) => {
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
        if (rowData.date) {
          const yyyymmdd = new FormatDate(rowData.date).yyyymmdd;
          if (['Transfer'].indexOf(rowData.operation) !== -1) {
            array.push(
              Object.values({
                date: rowData.date,
                account: rowData.accountSender,
                platform: rowData.platform,
                service: rowData.service,
                contractor: rowData.sender,
                coin: rowData.coin,
                pair: '',
                price: '',
                quantity: rowData.coinQty * -1,
                historicalCost:
                  historicalCoinPriceList[
                    new Hash$1(yyyymmdd + rowData.coin + 'USD').md5
                  ] *
                  rowData.coinQty *
                  -1,
                currentCost:
                  coinPriceList[new Hash$1(rowData.coin).md5] *
                  rowData.coinQty *
                  -1,
                comment: rowData.comment,
              })
            );
            array.push(
              Object.values({
                date: rowData.date,
                account: rowData.accountRecipient,
                platform: rowData.platform,
                service: rowData.service,
                contractor: rowData.recipient,
                coin: rowData.coin,
                pair: '',
                price: '',
                quantity: rowData.coinQty,
                historicalCost:
                  historicalCoinPriceList[
                    new Hash$1(yyyymmdd + rowData.coin + 'USD').md5
                  ] * rowData.coinQty,
                currentCost:
                  coinPriceList[new Hash$1(rowData.coin).md5] *
                  rowData.coinQty,
                comment: rowData.comment,
              })
            );
          } else if (['Claim'].indexOf(rowData.operation) !== -1) {
            array.push(
              Object.values({
                date: rowData.date,
                account: rowData.accountRecipient,
                platform: rowData.platform,
                service: rowData.service,
                contractor: rowData.recipient,
                coin: rowData.coin,
                pair: '',
                price: '',
                quantity: rowData.coinQty,
                historicalCost:
                  historicalCoinPriceList[
                    new Hash$1(yyyymmdd + rowData.coin + 'USD').md5
                  ] * rowData.coinQty,
                currentCost:
                  coinPriceList[new Hash$1(rowData.coin).md5] *
                  rowData.coinQty,
                comment: rowData.comment,
              })
            );
          } else if (rowData.operation === 'Buy') {
            const coinQty = rowData.coinQty
              ? rowData.coinQty
              : rowData.currencyQty / rowData.currencyPerCoin;
            array.push(
              Object.values({
                date: rowData.date,
                account: rowData.accountSender,
                platform: rowData.platform,
                service: rowData.service,
                contractor: rowData.sender,
                coin: rowData.currency,
                pair: rowData.coin,
                price: coinQty / rowData.currencyQty,
                quantity: rowData.currencyQty * -1,
                historicalCost:
                  historicalCoinPriceList[
                    new Hash$1(yyyymmdd + rowData.currency + 'USD').md5
                  ] *
                  rowData.currencyQty *
                  -1,
                currentCost:
                  coinPriceList[new Hash$1(rowData.currency).md5] *
                  rowData.currencyQty *
                  -1,
                comment: rowData.comment,
              })
            );
            array.push(
              Object.values({
                date: rowData.date,
                account: rowData.accountRecipient,
                platform: rowData.platform,
                service: rowData.service,
                contractor: rowData.recipient,
                coin: rowData.coin,
                pair: rowData.currency,
                price: rowData.currencyPerCoin
                  ? rowData.currencyPerCoin
                  : rowData.currencyQty / coinQty,
                quantity: coinQty,
                historicalCost:
                  historicalCoinPriceList[
                    new Hash$1(yyyymmdd + rowData.coin + 'USD').md5
                  ] * coinQty,
                currentCost:
                  coinPriceList[new Hash$1(rowData.coin).md5] * coinQty,
                comment: rowData.comment,
              })
            );
          } else if (rowData.operation === 'Sell') {
            const currencyQty = rowData.currencyQty
              ? rowData.currencyQty
              : rowData.coinQty * rowData.currencyPerCoin;
            array.push(
              Object.values({
                date: rowData.date,
                account: rowData.accountSender,
                platform: rowData.platform,
                service: rowData.service,
                contractor: rowData.sender,
                coin: rowData.coin,
                pair: rowData.currency,
                price: rowData.currencyPerCoin
                  ? rowData.currencyPerCoin
                  : currencyQty / rowData.coinQty,
                quantity: rowData.coinQty * -1,
                historicalCost:
                  historicalCoinPriceList[
                    new Hash$1(yyyymmdd + rowData.coin + 'USD').md5
                  ] *
                  rowData.coinQty *
                  -1,
                currentCost:
                  coinPriceList[new Hash$1(rowData.coin).md5] *
                  rowData.coinQty *
                  -1,
                comment: rowData.comment,
              })
            );
            array.push(
              Object.values({
                date: rowData.date,
                account: rowData.accountRecipient,
                platform: rowData.platform,
                service: rowData.service,
                contractor: rowData.recipient,
                coin: rowData.currency,
                pair: rowData.coin,
                price: rowData.coinQty / currencyQty,
                quantity: currencyQty,
                historicalCost:
                  historicalCoinPriceList[
                    new Hash$1(yyyymmdd + rowData.currency + 'USD').md5
                  ] * currencyQty,
                currentCost:
                  coinPriceList[new Hash$1(rowData.currency).md5] *
                  currencyQty,
                comment: rowData.comment,
              })
            );
          }
        }
        return array
      },
      [this.head.getHeaderAlias(this.head.transaction)]
    );
    this.uptdateBalance(dataSet);
    portfolioTransaction.deleteFilter().insertValues(dataSet).deleteEmptyRows();
  }

  uptdateBalance(transaction = []) {
    const portfolioBalance = new GasWorkSheet('portfolio', 'balance');
    const balanceAgg = transaction.slice(1).reduce((target, source, index) => {
      const row = {
        date: new FormatDate(
          source[this.head.transaction.date.idx]
        ).getFormatDate('yyyy-MM-dd'),
        account: source[this.head.transaction.account.idx].toUpperCase(),
        contractor: source[this.head.transaction.contractor.idx].toUpperCase(),
        coin: source[this.head.transaction.coin.idx],
        quantity: source[this.head.transaction.quantity.idx],
      };
      if (!target[row.date]) {
        target[row.date] = {};
      }
      if (!target[row.date][row.account]) {
        target[row.date][row.account] = {};
      }
      if (!target[row.date][row.account][row.contractor]) {
        target[row.date][row.account][row.contractor] = {};
      }
      if (!target[row.date][row.account][row.contractor][row.coin]) {
        target[row.date][row.account][row.contractor][row.coin] = 0;
      }

      target[row.date][row.account][row.contractor][row.coin] += row.quantity;

      return target
    }, {});
    const dataSet = [this.head.getHeaderAlias(this.head.balance)];
    Object.entries(balanceAgg).forEach((level0) => {
      const date = level0[0];
      Object.entries(level0[1]).forEach((level1) => {
        const account = level1[0];
        Object.entries(level1[1]).forEach((level2) => {
          const contractor = level2[0];
          Object.entries(level2[1]).forEach((level3) => {
            const symbol = level3[0];
            const quantity = level3[1];
            if (quantity) {
              dataSet.push([date, account, contractor, symbol, quantity]);
            }
          });
        });
      });
    });

    portfolioBalance
      .deleteFilter()
      .insertValues(dataSet)
      .deleteEmptyRows()
      .deleteEmptyColumns();
  }
}

function updateCoinPrice() {
  new Portfolio().updateCoinPrice();
}

function updateCoinList() {
  new Portfolio().updateCoinList();
}

function updateTransaction() {
  new Portfolio().updateTransaction();
}

function updateHistoricalPriceKey() {
  new Portfolio().updateHistoricalPriceKey();
}
