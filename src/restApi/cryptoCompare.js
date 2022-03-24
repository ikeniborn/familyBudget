import { Methods } from './fetch'
import { FormatDate } from '../utils'
export { Price, CoinsList }
/**
 * CryptoCompare instance
 */
class Instance {
  /**
   * Create new inctance API CryptoCompare
   *
   */
  constructor() {
    if (Instance.exists) {
      return Instance.instance
    }
    Instance.instance = this
    Instance.exists = true
    this.methods = new Methods({
      domain: 'https://min-api.cryptocompare.com/data',
      query: {
        api_key:
          '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125',
      },
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
  constructor() {
    this.methods = new Instance().methods
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
    const upperTsyms = tsyms.toUpperCase()
    return Object.entries(
      this.methods.get({
        endPoint: '/pricemulti',
        query: {
          fsyms: fsyms.toUpperCase(),
          tsyms: tsyms.toUpperCase(),
          relaxedValidation: true,
        },
      })
    ).map(([symbol, tsymsValue]) => {
      return { symbol: symbol, price: tsymsValue[upperTsyms] }
    })
  }

  getMultiFullPrice(fsyms = '', tsyms = 'USD') {
    const upperTsyms = tsyms.toUpperCase()
    return Object.entries(
      this.methods.get({
        endPoint: '/pricemultifull',
        query: {
          fsyms: fsyms.toUpperCase(),
          tsyms: tsyms.toUpperCase(),
          relaxedValidation: true,
        },
      })
    ).map(([symbol, tsymsValue]) => {
      return [symbol, tsymsValue[upperTsyms]]
    })
  }

  getHistoryPrice(fsym = 'BTC', ts = new Date(), tsyms = 'USD') {
    const dateUnix = new FormatDate(ts).unix
    const upperTsyms = tsyms.toUpperCase()
    const upperFsym = fsym.toUpperCase()
    const result = this.methods.get({
      endPoint: '/pricehistorical',
      query: {
        fsym: upperFsym,
        tsyms: upperTsyms,
        ts: dateUnix,
      },
    })
    if (!result.Response) {
      return result[upperFsym][upperTsyms]
    } else {
      return void 0
    }
  }
}
/**
 * CryptoCompare coin list
 */
class CoinsList {
  constructor() {
    this.methods = new Instance().methods
  }
  getCoinsList() {
    return this.methods.get({ endPoint: '/all/coinlist' })?.Data
  }
}
