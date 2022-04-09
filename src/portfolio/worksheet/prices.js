import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
// import * as cryptoRank from '../../restApi/cryptoRank'
import * as cryptoCompare from '../../restApi/cryptoCompare'
// import * as coinMarketCap from '../../restApi/coinMarketCap'
import * as coinGecko from '../../restApi/coinGecko'
import { Log } from './log'
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
      // const coins = new Portfolio().getWorkSheet('coins').arrayOfObject
      const coins = new Portfolio().getWorkSheet('coins').object

      this.workSheet.arrayOfObject.forEach((object) => {
        const coinsKey = new Hash(object.source + object.name + object.symbol)
          .md5
        // const coin = coins.filter((row) => {
        //   return (
        //     new RegExp(object.name.toString().toLowerCase(), 'g').test(
        //       row.name.toString().toLowerCase()
        //     ) &&
        //     new Hash(object.source).md5 === new Hash(row.source).md5 &&
        //     new Hash(object.symbol).md5 === new Hash(row.symbol).md5
        //   )
        // })[0]
        object.id = coins[coinsKey]?.id || '#N/A'
        if (
          new Hash(object.source).md5 === new Hash('cryptoCompare'.md5) &&
          !object.price
        ) {
          object.price = new cryptoCompare.Price().getSinglePrice(
            coins[coinsKey]?.id
          )
        }
        // this.workSheet.updateRow(object)
        this.workSheet.insertValue(
          object.id,
          object.rowNum,
          this.workSheet.head.id.idx + 1
        )
      })

      // this.workSheet.arrayOfObject.forEach((object) => {
      //   // new Log().addMessage('Prices.updateId', 'object', object)
      //   this.workSheet.updateRow(object)
      // })
    } catch (error) {
      new Log().addError('Prices.updateId', error)
    }
  }

  updateRisk(symbol, marketCapRank = 0) {
    try {
      const price = this.workSheet.object[new Hash(symbol).md5]
      const symbolType = this.symbolType[new Hash(price?.symbolType).md5]
      if (symbolType?.name !== 'MarketCap') {
        price.riskCategory =
          symbolType?.strategy +
          ' (' +
          this.strategy[new Hash(symbolType?.strategy).md5]?.distribution *
            100 +
          '%)'
      } else {
        if (marketCapRank <= 100) {
          price.riskCategory =
            'Top 100 (' +
            this.strategy[new Hash('Top 100').md5]?.distribution * 100 +
            '%)'
        } else if (marketCapRank > 100 && marketCapRank <= 500) {
          price.riskCategory =
            'Top 500 (' +
            this.strategy[new Hash('Top 500').md5]?.distribution * 100 +
            '%)'
        } else if (marketCapRank > 500 && marketCapRank <= 1000) {
          price.riskCategory =
            'Top 1000 (' +
            this.strategy[new Hash('Top 1000').md5]?.distribution * 100 +
            '%)'
        } else if (marketCapRank > 1000 || !marketCapRank) {
          price.riskCategory =
            'Other (' +
            this.strategy[new Hash('Other').md5]?.distribution * 100 +
            '%)'
        }
      }
    } catch (error) {
      new Log().addError('Prices.updateRisk', error)
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
      new Log().addError('Prices.updatePrice', error)
    }
  }

  updatePrices() {
    try {
      new Promise((resolve) => {
        this.symbolType = new Portfolio().getWorkSheet('symbolType').object
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

        // if (listId.custom.length) {
        //   listId.custom.forEach((symbol) => {
        //     const HistoricalPricesAvgKey = new Hash(
        //       'ikeniborn' + 'no project' + symbol
        //     ).md5
        //     const histirocalPrice =
        //       this.HistoricalPricesAvg[HistoricalPricesAvgKey]?.priceAvg ||
        //       void 0
        //     this.updatePrice(symbol, histirocalPrice)
        //     this.updateRisk(symbol)
        //   })
        // }
        resolve()
      }).then(this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject))
    } catch (error) {
      new Log().addError('Prices.updatePrices', error)
    }
  }
}
