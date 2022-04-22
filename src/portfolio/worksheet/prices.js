import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
// import * as cryptoRank from '../../restApi/cryptoRank'
import * as cryptoCompare from '../../restApi/cryptoCompare'
// import * as coinMarketCap from '../../restApi/coinMarketCap'
import * as coinGecko from '../../restApi/coinGecko'
import { Coins } from './coins'
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
      const coins = new Coins().workSheet.object
      this.workSheet.arrayOfObject.forEach((object) => {
        const coinsKey = new Hash(object.source + object.name + object.symbol)
          .md5

        object.id = coins[coinsKey]?.id || void 0
        if (
          new Hash(object.source).md5 === '1dab445b170a7f0acfccea645a8879e0' &&
          !object.price
        ) {
          object.price = new cryptoCompare.Price().getSinglePrice(
            coins[coinsKey]?.id
          )
        }

        this.workSheet.insertValue(
          object.id,
          object.rowNum,
          this.workSheet.head.id.idx + 1
        )
      })
    } catch (error) {
      this.workSheet.log.addError('Prices.updateId', error)
    }
  }

  updateRisk(symbol, marketCapRank = 0) {
    try {
      const price = this.workSheet.object[new Hash(symbol).md5]
      const categoryKey = new Hash(price?.category).md5
      const symbolCategory = this.symbolCategory[categoryKey]
      const riskCategory = this.riskCategory[
        new Hash(symbolCategory?.riskCategory).md5
      ]
      const riskCategoryKey = new Hash(riskCategory?.name).md5
      if (riskCategoryKey !== '0264bc825e9c4af5f34c5a9d6d807f31') {
        price.riskCategory =
          riskCategory?.strategy +
          ' (' +
          this.strategy[new Hash(riskCategory?.strategy).md5]?.distribution *
            100 +
          '%)'
      } else {
        if (marketCapRank <= 100) {
          price.riskCategory =
            'Top 100 (' +
            this.strategy['5b93ad92b4d924219e0d8fff2393a5d6']?.distribution *
              100 +
            '%)'
        } else if (marketCapRank > 100 && marketCapRank <= 500) {
          price.riskCategory =
            'Top 500 (' +
            this.strategy['c53ded038e27eacf4b3124fca6b5e777']?.distribution *
              100 +
            '%)'
        } else if (marketCapRank > 500 && marketCapRank <= 1000) {
          price.riskCategory =
            'Top 1000 (' +
            this.strategy['7a62ba4a955d8ea7e7066f0cd420320c']?.distribution *
              100 +
            '%)'
        } else if (marketCapRank > 1000 || !marketCapRank) {
          price.riskCategory =
            'Other (' +
            this.strategy['795f3202b17cb6bc3d4b771d8c6c9eaf']?.distribution *
              100 +
            '%)'
        }
      }
    } catch (error) {
      this.workSheet.log.addError('Prices.updateRisk', error)
    }
  }

  updatePrice(symbol, price) {
    try {
      const symbolKey = new Hash(symbol).md5
      if (price) {
        this.workSheet.object[symbolKey].price = price
      } else {
        this.workSheet.object[symbolKey].price = void 0
      }
      this.workSheet.object[symbolKey].update = new Date()
    } catch (error) {
      this.workSheet.log.addError('Prices.updatePrice', error)
    }
  }

  updatePrices() {
    try {
      new Promise((resolve) => {
        this.riskCategory = new Portfolio().getWorkSheet('riskCategory').object
        this.symbolCategory = new Portfolio().getWorkSheet(
          'symbolCategory'
        ).object
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
            new Hash(source).md5 !==
            '8b9035807842a4e4dbe009f3f1478127' /*custom*/
              ? idArray.join(',')
              : idArray,
          ])
        )

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

        resolve()
      }).then(this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject))
    } catch (error) {
      this.workSheet.log.addError('Prices.updatePrices', error)
    }
  }
}

//* Deprecated
//* Prices.updateId
// const coins = new Portfolio().getWorkSheet('coins').arrayOfObject
// const coin = coins.filter((row) => {
//   return (
//     new RegExp(object.name.toString().toLowerCase(), 'g').test(
//       row.name.toString().toLowerCase()
//     ) &&
//     new Hash(object.source).md5 === new Hash(row.source).md5 &&
//     new Hash(object.symbol).md5 === new Hash(row.symbol).md5
//   )
// })[0]
// this.workSheet.updateRow(object)
// this.workSheet.arrayOfObject.forEach((object) => {
//   //  this.workSheet.log.addMessage('Prices.updateId', 'object', object)
//   this.workSheet.updateRow(object)
// })
//* Prices.updatePrices
// if (listId.cryptorank) {
//   new cryptoRank.Price().getLastPrice(listId.cryptorank).forEach((coin) => {
//     updatePrice(coin.symbol, coin.values.USD.price)
//     updateRisk(coin.symbol, coin.rank)
//   })
// }
// if (listId.coinmarketcap) {
//   Object.values(
//     new coinMarketCap.Price().getLastPrice(listId.coinmarketcap)
//   ).forEach((coin) => {
//     updatePrice(coin.symbol, coin.quote.USD.price)
//     updateRisk(coin.symbol, coin.cmc_rank)
//   })
// }
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
