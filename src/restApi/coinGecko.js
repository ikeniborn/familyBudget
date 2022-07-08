import { Methods } from './fetch'
import { FormatDate, Hash } from '../utils'
export { Price, CoinsList, Coins }

/**
 * CoinGecko instance
 */
class Instance {
  /**
   * Create new inctance API CoinGecko
   */
  constructor() {
    if (Instance.exists) {
      return Instance.instance
    }
    Instance.instance = this
    Instance.exists = true
    this.methods = new Methods({
      domain: 'https://api.coingecko.com/api/v3',
      data: {
        muteHttpExceptions: true,
        header: 'accept: application/json',
      },
    })
  }
}
/**
 * CoinGecko price
 */
class Price {
  constructor() {
    this.methods = new Instance().methods
  }

  /**
   *
   * @param {*} ids
   * @param {*} vs_currencies
   * @param {*} include_market_cap
   * @param {*} include_24hr_vol
   * @param {*} include_24hr_change
   * @param {*} include_last_updated_at
   * @returns
   */
  getSimplePrice(
    ids,
    vs_currencies,
    include_market_cap = false,
    include_24hr_vol = false,
    include_24hr_change = false,
    include_last_updated_at = false
  ) {
    return this.methods.get({
      endPoint: '/simple/price',
      query: {
        ids,
        vs_currencies,
        include_market_cap,
        include_24hr_vol,
        include_24hr_change,
        include_last_updated_at,
      },
    })
  }

  /**
   *
   * @param {*} ids
   * @param {*} vs_currency
   * @param {*} price_change_percentage
   * @returns
   */
  getMarketsPrice(
    ids,
    vs_currency = 'usd',
    price_change_percentage = '24h,7d,30d'
  ) {
    return (
      this.methods.get({
        endPoint: '/coins/markets',
        query: {
          vs_currency,
          ids,
          price_change_percentage,
        },
      }) || []
    )
  }
}
/**
 * CoinGecko coin list
 */
class CoinsList {
  constructor() {
    this.methods = new Instance().methods
  }
  /**
   *
   * @param {*} include_platform
   * @returns
   */
  getCoinsList(include_platform = false) {
    return (
      this.methods.get({
        endPoint: '/coins/list',
        query: {
          include_platform,
        },
      }) || []
    )
  }
}

class Coins {
  constructor() {
    this.methods = new Instance().methods
  }
  /**
   *
   * @param {*} include_platform
   * @returns
   */
  getCoinsList(include_platform = false) {
    return (
      this.methods.get({
        endPoint: '/coins/list',
        query: {
          include_platform,
        },
      }) || []
    )
  }

  getCoinsRange(
    id = 'bitcoin',
    vs_currency = 'usd',
    fromUnix = void 0,
    toUnix = void 0
  ) {
    const lowerVs_currency = vs_currency.toLowerCase()
    const lowerId = id.toLowerCase()
    const result =
      this.methods.get({
        endPoint: '/coins/{id}/market_chart/range',
        path: {
          id: lowerId,
        },
        query: {
          vs_currency: lowerVs_currency,
          from: fromUnix + '',
          to: toUnix + '',
        },
      }) || {}

    if (Object.keys(result).length) {
      const aggData = result?.prices.reduce((object, [dateValue, data]) => {
        const dateData = new FormatDate(dateValue).getDateBegin()
        const dateKey = dateData.dateKey
        if (!object[dateKey]) {
          object[dateKey] = {
            dateKey: dateKey,
            dateString: dateData.date,
            dateUnix: dateData.unix,
            dateValue: dateData.value,
            timeZone: dateData.timeZone,
            price: data,
            marketCap: void 0,
            volume: void 0,
          }
        }
        return object
      }, {})
      result?.market_caps.forEach(([dateValue, data]) => {
        const dateKey = new FormatDate(dateValue).getDateBegin().dateKey
        aggData[dateKey].marketCap = data
      })
      result?.total_volumes.forEach(([dateValue, data]) => {
        const dateKey = new FormatDate(dateValue).getDateBegin().dateKey
        aggData[dateKey].volume = data
      })
      return aggData
    }
    return result
  }
}
