import { Methods } from './fetch'
import { FormatDate, Hash } from '../utils'
export { Price, CoinsList, TopList }
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
    const priceArray = []
    const upperTsyms = tsyms.toUpperCase()
    const fsymsArray = fsyms.split(',')
    const fsymsArrayOfArray = new Array(Math.ceil(fsymsArray.length / 25))
      .fill()
      .map((_) => fsymsArray.splice(0, 25))
    fsymsArrayOfArray.forEach((fsymsPart) => {
      const result = this.methods.get({
        endPoint: '/pricemulti',
        query: {
          fsyms: fsymsPart.join(',').toUpperCase(),
          tsyms: tsyms.toUpperCase(),
          relaxedValidation: true,
        },
      })
      if (!result.Response) {
        return Object.entries(result).forEach(([symbol, tsymsValue]) => {
          priceArray.push({ symbol: symbol, price: tsymsValue[upperTsyms] })
        })
      } else {
        console.error(result.Message)
      }
    })
    return priceArray
  }

  getMultiFullPrice(fsyms = '', tsyms = 'USD') {
    const upperTsyms = tsyms.toUpperCase()
    const result = this.methods.get({
      endPoint: '/pricemultifull',
      query: {
        fsyms: fsyms.toUpperCase(),
        tsyms: tsyms.toUpperCase(),
        relaxedValidation: true,
      },
    })
    if (!result.Response) {
      return Object.entries(result).map(([symbol, tsymsValue]) => {
        return [symbol, tsymsValue[upperTsyms]]
      })
    } else {
      return void 0
    }
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

class TopList {
  constructor() {
    this.methods = new Instance().methods
  }
  topListBy24h(limit = 100, page = 1, tsym = 'usd') {
    const upperTsym = tsym.toUpperCase()
    const arrayOfObject =
      this.methods.get({
        endPoint: '/top/totalvolfull',
        query: {
          tsym: upperTsym,
          limit,
          page,
        },
      })?.Data || []
    const startPosition = limit * page - (limit - 1)
    return arrayOfObject.reduce((list, object, index) => {
      const key = new Hash(object.CoinInfo.Internal).md5
      if (!list[key]) {
        list[key] = {}
      }
      list[key]['rank'] = startPosition + index
      return list
    }, {})
  }
}
