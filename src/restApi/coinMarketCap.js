import { Methods } from './fetch'
export { Instance, Price, CoinsList }

/**
 * CoinMarketCap instance
 */
class Instance {
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
    })
  }
}
/**
 * CoinMarketCap Price
 */
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
    this.methods = instance.methods
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
