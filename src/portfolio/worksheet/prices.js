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
    try {
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
    } catch (error) {
      console.error('Prices.updateId', error)
    }
  }

  getHistoricalPrice(account, project, date, symbol, convert = 'usd') {
    try {
      const coin = this.workSheet.object[new Hash(symbol).md5]
      const sourceKey = new Hash(coin.source).md5
      const id = coin.id
      const coinTypeKey = new Hash(coin.coinType).md5
      if (
        ['stablecoin', 'fiat']
          .map((m) => (m = new Hash(m).md5))
          .indexOf(coinTypeKey) === -1
      ) {
        if (
          new FormatDate(date).yyyymmdd === new FormatDate().yyyymmdd &&
          sourceKey === new Hash('coingecko').md5
        ) {
          return new coinGecko.Price()
            .getMarketsPrice(id)
            .reduce((price, data) => {
              price = data.current_price
              return price
            }, 0)
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
    } catch (error) {
      console.error('Prices.getHistoricalPrice', error)
    }
  }

  updateRisk(symbol, marketCapRank = 0) {
    try {
      const price = this.workSheet.object[new Hash(symbol).md5]
      const coinType = this.coinType[new Hash(price.coinType).md5]
      if (coinType.name !== 'MarketCap') {
        price.risk =
          coinType.strategy +
          ' (' +
          this.strategy[new Hash(coinType.strategy).md5]?.distribution * 100 +
          '%)'
      } else {
        if (marketCapRank <= 100) {
          price.risk =
            'Top 100 (' +
            this.strategy[new Hash('Top 100').md5]?.distribution * 100 +
            '%)'
        } else if (marketCapRank > 100 && marketCapRank <= 1000) {
          price.risk =
            'Top 1000 (' +
            this.strategy[new Hash('Top 1000').md5]?.distribution * 100 +
            '%)'
        } else if (marketCapRank > 1000 || !marketCapRank) {
          price.risk =
            'Other (' +
            this.strategy[new Hash('Other').md5]?.distribution * 100 +
            '%)'
        }
      }
    } catch (error) {
      console.error('Prices.updateRisk', error)
    }
  }

  updatePrice(symbol, price) {
    try {
      if (price) {
        this.workSheet.object[new Hash(symbol).md5].price = price
      } else {
        this.workSheet.object[new Hash(symbol).md5].price = void 0
      }
      this.workSheet.object[new Hash(symbol).md5].update = new Date()
    } catch (error) {
      console.error('Prices.updatePrice', error)
    }
  }

  updatePrices() {
    try {
      new Promise((resolve) => {
        this.coinType = new Portfolio().getWorkSheet('CoinType').object
        this.strategy = new Portfolio().getWorkSheet('strategy').object
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

        // if (listId.cryptorank) {
        //   new cryptoRank.Price().getLastPrice(listId.cryptorank).forEach((coin) => {
        //     updatePrice(coin.symbol, coin.values.USD.price)
        //     updateRisk(coin.symbol, coin.rank)
        //   })
        // }

        if (listId.coingecko) {
          const priceArray = new coinGecko.Price().getMarketsPrice(
            listId.coingecko
          )
          if (priceArray.length) {
            priceArray.forEach((coin) => {
              this.updatePrice(coin.symbol, coin.current_price)
              this.updateRisk(coin.symbol, coin.market_cap_rank)
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
            const topMarketCap = new cryptoCompare.TopList().topMarketCap(1000)
            priceArray.forEach((coin) => {
              this.updatePrice(coin.symbol, coin.price)
              const key = new Hash(coin.symbol).md5
              const rank = topMarketCap[key]?.rank || 1000
              this.updateRisk(coin.symbol, rank)
            })
          }
        }

        if (listId.custom.length) {
          const histirocalPrices = new Portfolio().getWorkSheet(
            'historicalPrices'
          ).object
          listId.custom.forEach((symbol) => {
            const histirocalPricesKey = new Hash(
              'ikeniborn' + 'no project' + symbol
            ).md5
            const histirocalPrice =
              histirocalPrices[histirocalPricesKey]?.priceAvg || void 0
            this.updatePrice(symbol, histirocalPrice)
            this.updateRisk(symbol)
          })
        }
        resolve()
      }).then(this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject))
    } catch (error) {
      console.error('Prices.updatePrices', error)
    }
  }
}
