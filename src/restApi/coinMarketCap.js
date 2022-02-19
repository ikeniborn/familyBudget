import { Methods } from './fetch'
export { Instance, Price, CoinsList }

class Instance {
  /**
   * Create new inctance API CoinMarketCap
   *s
   * @param {string} apiKey
   */
  constructor(apiKey) {
    this.methods = new Methods({
      domain: 'https://pro-api.coinmarketcap.com/v1',
      data: {
        muteHttpExceptions: true,
        contentType: 'accept: application/json',
        headers: { 'X-CMC_PRO_API_KEY': apiKey },
      },
    })
  }
}
class Price {
  /**
   * @param {object} instance instance API CoinMarketCap
   */
  constructor(instance) {
    this.methods = instance.methods
  }
  /**
   * Get last price
   *
   * @param {*} id
   * @param {*} convert
   * @returns
   */
  getLastPrice(id = '1', convert = 'USD') {
    return this.methods.get({
      endPoint: '/cryptocurrency/quotes/latest',
      query: {
        id,
        convert,
      },
    })?.data
  }
}

class CoinsList {
  /**
   * @param {object} instance instance API CoinMarketCap
   */
  constructor(instance) {
    this.methods = instance.methods
  }
  /**
   * Get coins list
   *
   * @returns
   */
  getCoinsList() {
    return this.methods.get({
      endPoint: '/cryptocurrency/map',
    })?.data
  }
}
