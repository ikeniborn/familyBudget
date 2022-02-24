import { Methods } from './fetch'
export { Instance, Price, CoinsList }

/**
 * CryptoRank instance
 */
class Instance {
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
    })
  }
}
/**
 * CryptoRank price
 */
class Price {
  /**
   * @param {object} instance instance API CryptoRank
   */
  constructor(instance) {
    this.methods = instance.methods
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
class CoinsList {
  /**
   * @param {object} instance instance API CryptoRank
   */
  constructor(instance) {
    this.methods = instance.methods
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
