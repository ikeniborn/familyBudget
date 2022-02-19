import { Methods } from './fetch'
export { Instance, Price, CoinsList }

class Instance {
  /**
   * Create new inctance API ExchangeRatesApi
   *
   * @param {string} apiKey
   */
  constructor(apiKey) {
    this.methods = new Methods({
      domain: 'https://openexchangerates.org/api',
      query: { app_id: apiKey },
      data: {
        muteHttpExceptions: true,
        contentType: 'application/json',
      },
    })
  }
}
class CoinsList {
  /**
   * @param {object} instance instance API ExchangeRatesApi
   */
  constructor(instance) {
    this.methods = instance.methods
  }
  /**
   *
   * @returns
   */
  getCoinsList() {
    return this.methods.get({ endPoint: '/currencies.json' })?.symbols
  }
}

class Price {
  /**
   * @param {object} instance instance API ExchangeRatesApi
   */
  constructor(instance) {
    this.methods = instance.methods
  }
  /**
   *
   * @param {*} symbols
   * @param {*} base
   * @returns
   */
  getLastPrice(symbols = 'USD', base = 'USD') {
    return this.methods.get({
      endPoint: '/latest.json',
      query: {
        base,
        symbols,
      },
    })?.rates
  }

  /**
   *
   * @param {string} date The requested date in YYYY-MM-DD format (required).
   * @param {string} symbols
   * @param {string} base
   * @returns
   */
  getHistoryPrice(date, symbols = 'USD', base = 'USD') {
    return this.methods.get({
      endPoint: '/historical/{date}.json',
      path: { date },
      query: {
        base,
        symbols,
      },
    })
  }
}
