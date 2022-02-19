import { Methods } from './fetch'
export { Instance, Price, CoinsList }

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
class CoinsList {
  /**
   * @param {object} instance instance API CoinMarketCap
   */
  constructor(instance) {
    this.methods = instance.methods
  }
  getCoinsList() {
    return this.methods.get({ endPoint: '/all/coinlist' })?.Data
  }
}
