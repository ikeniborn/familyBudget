import { Methods } from './fetch'
export { Price, CoinsList, Category }
/**
 * CoinMarketCap instance
 */
class Instance {
  constructor() {
    if (Instance.exists) {
      return Instance.instance
    }
    Instance.instance = this
    Instance.exists = true
    this.methods = new Methods({
      domain: 'https://pro-api.coinmarketcap.com',
      data: {
        muteHttpExceptions: true,
        contentType: 'accept: application/json',
        headers: {
          'X-CMC_PRO_API_KEY': '133c18b7-555c-4e57-ad7b-4d2bf6160c20',
        },
      },
    })
  }
}
/**
 * CoinMarketCap Price
 */
class Price {
  constructor() {
    this.methods = new Instance().methods
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
  constructor() {
    this.methods = new Instance().methods
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
    this.methods = new Instance().methods
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
    })?.data
    return object[id]?.tags.join(', ')
  }
  getCategories() {
    const object = this.methods.get({
      endPoint: '/v1/cryptocurrency/categories',
    })?.data
    return object
  }
}
