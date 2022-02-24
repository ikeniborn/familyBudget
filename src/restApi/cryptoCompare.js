import { Methods } from './fetch'
export { Instance, Price, CoinsList }
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
    })
  }
}
/**
 * CryptoCompare price
 */
class Price {
  /**
   * @param {object} instance instance API CryptoCompare
   */
  constructor(instance) {
    this.methods = instance.methods
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
      : (ts = new Date(ts).valueOf() / 1000)
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
class CoinsList {
  /**
   * @param {object} instance instance API CryptoCompare
   */
  constructor(instance) {
    this.methods = instance.methods
  }
  getCoinsList() {
    return this.methods.get({ endPoint: '/all/coinlist' })?.Data
  }
}
