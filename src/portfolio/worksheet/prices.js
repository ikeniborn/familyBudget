import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import * as cryptoRank from '../../restApi/cryptoRank'
import * as cryptoCompare from '../../restApi/cryptoCompare'
import * as coinMarketCap from '../../restApi/coinMarketCap'
import * as coinGecko from '../../restApi/coinGecko'
export { Prices }

class Prices {
  constructor(workSheet = '') {
    if (Prices.exists) {
      return Prices.instance
    }
    Prices.instance = this
    Prices.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Prices')
  }

  updateId() {
    const coinsArray = new Portfolio().getWorkSheet('coins').arrayOfObject
    this.workSheet.arrayOfObject.map((object) => {
      const coinPrice = coinsArray.filter((row) => {
        return (
          new RegExp(object.name.toString().toLowerCase(), 'g').test(
            row.name.toString().toLowerCase()
          ) &&
          new Hash(object.source).md5 === new Hash(row.source).md5 &&
          new Hash(object.symbol).md5 === new Hash(row.symbol).md5
        )
      })[0]
      object.id = coinPrice?.id || '#N/A'
      return object
    })

    this.workSheet.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object)
    })
  }

  getHistoricalPrice(account, project, date, symbol, convert = 'usd') {
    const coin = this.workSheet.object[new Hash(symbol).md5]
    const source = coin.source
    const id = coin.id
    const risk = coin.risk
    if (new Hash('Stablecoin/Fiat').md5 !== new Hash(risk).md5) {
      if (new FormatDate(date).yyyymmdd === new FormatDate().yyyymmdd) {
        if (new Hash(source).md5 === new Hash('cryptorank').md5) {
          return new cryptoRank.Price()
            .getLastPrice(id)
            .reduce((price, data) => {
              price = data.values.USD.price
              return price
            }, 0)
        } else if (new Hash(source).md5 === new Hash('cryptocompare').md5) {
          return Object.values(
            new cryptoCompare.Price().getMultiPrice(id)
          ).reduce((price, data) => {
            price = data.USD
            return price
          }, 0)
        } else if (new Hash(source).md5 === new Hash('coingecko').md5) {
          return new coinGecko.Price()
            .getMarketsPrice(id)
            .reduce((price, data) => {
              price = data.current_price
              return price
            }, 0)
        } else if (new Hash(source).md5 === new Hash('coinmarketcap').md5) {
          return Object.values(
            new coinMarketCap.Price().getLastPrice(id)
          ).reduce((price, data) => {
            price = data.quote.USD.price
            return price
          }, 0)
        }
      } else {
        let historicalPrice
        if (new Hash(source).md5 === new Hash('cryptocompare').md5) {
          historicalPrice = new cryptoCompare.Price().getHistoryPrice(
            id,
            date,
            convert
          )
        }
        if (historicalPrice) {
          return historicalPrice
        } else {
          const histirocalPrices = new Portfolio().getWorkSheet(
            'historicalPrices'
          ).object
          return (
            histirocalPrices[new Hash(account + project + symbol).md5]
              ?.priceBuy || void 0
          )
        }
      }
    } else {
      return 1
    }
  }

  updatePrices() {
    const listId = Object.fromEntries(
      Object.entries(
        this.workSheet.arrayOfObject.reduce((list, object) => {
          if (!list[object.source]) {
            list[object.source] = []
          }
          if (object.id && object.source !== 'custom') {
            list[object.source].push(object.id)
          } else {
            list[object.source].push(object.symbol)
          }
          return list
        }, {})
      ).map(([source, idArray]) => [
        source,
        source !== 'custom' ? idArray.join(',') : idArray,
      ])
    )
    const top100 = new cryptoCompare.TopList().topListBy24h(100, 1)
    const updateRisk = (symbol, rank = 1000) => {
      const coin = this.workSheet.object[new Hash(symbol).md5]
      if (['Stablecoin', 'Fiat'].indexOf(coin.coinType) !== -1) {
        coin.risk = 'Stablecoin/Fiat'
      } else if (['LP token'].indexOf(coin.coinType) !== -1) {
        coin.risk = 'Very High'
      } else {
        let rank_ = rank
        if (coin.source === 'custom') {
          rank_ = 1000
        }
        if (rank_ <= 10) {
          coin.risk = 'Very low'
        } else if (rank_ <= 50) {
          coin.risk = 'Low'
        } else if (rank_ <= 100) {
          coin.risk = 'Middle'
        } else if (rank_ > 100) {
          coin.risk = 'High'
        }
      }
    }

    const updatePrice = (symbol, price) => {
      if (price) {
        this.workSheet.object[new Hash(symbol).md5].price = price
      } else {
        this.workSheet.object[new Hash(symbol).md5].price = void 0
      }
      this.workSheet.object[new Hash(symbol).md5].update = new Date()
    }

    // if (listId.cryptorank) {
    //   new cryptoRank.Price().getLastPrice(listId.cryptorank).forEach((coin) => {
    //     updatePrice(coin.symbol, coin.values.USD.price)
    //     updateRisk(coin.symbol, coin.rank)
    //   })
    // }

    if (listId.coingecko) {
      const priceArray = new coinGecko.Price().getMarketsPrice(listId.coingecko)
      if (priceArray.length) {
        priceArray.forEach((coin) => {
          updatePrice(coin.symbol, coin.current_price)
          updateRisk(coin.symbol, coin.market_cap_rank)
        })
      }
    }

    // if (listId.coinmarketcap) {
    //   Object.values(
    //     new coinMarketCap.Price().getLastPrice(listId.coinmarketcap)
    //   ).forEach((coin) => {
    //     updatePrice(coin.symbol, coin.quote.USD.price)
    //     updateRisk(coin.symbol, coin.cmc_rank)
    //   })
    // }

    if (listId.cryptocompare) {
      const priceArray = new cryptoCompare.Price().getMultiPrice(
        listId.cryptocompare
      )
      if (priceArray.length) {
        priceArray.forEach((coin) => {
          updatePrice(coin.symbol, coin.price)
          const key = new Hash(coin.symbol).md5
          const rank = top100[key]?.rank || 1000
          updateRisk(coin.symbol, rank)
        })
      }
    }

    if (listId.custom.length) {
      const histirocalPrices = new Portfolio().getWorkSheet('historicalPrices')
        .object
      listId.custom.forEach((symbol) => {
        const histirocalPricesKey = new Hash(
          'ikeniborn' + 'no project' + symbol
        ).md5
        const histirocalPrice =
          histirocalPrices[histirocalPricesKey]?.priceAvg || void 0
        updatePrice(symbol, histirocalPrice)
        updateRisk(symbol)
      })
    }
    this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject)
  }
}
