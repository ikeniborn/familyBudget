import { Methods } from './fetch'
import * as utils from '../utils'
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
    const dateUnix = new utils.FormatDate(ts).unix
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
