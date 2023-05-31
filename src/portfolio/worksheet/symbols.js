import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import * as cryptoRank from '../../restApi/cryptoRank'
import * as cryptoCompare from '../../restApi/cryptoCompare'
// import * as coinMarketCap from '../../restApi/coinMarketCap'
import * as coinGecko from '../../restApi/coinGecko'
import * as web3Space from '../../restApi/web3Space'
// import { Transactions } from './transactions'
import { Coins } from './coins'
export { Symbols }

class Symbols {
  constructor(workSheet = '') {
    if (Symbols.exists) {
      return Symbols.instance
    }
    Symbols.instance = this
    Symbols.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Symbols')
  }

  updateId() {
    try {
      const coins = new Coins().workSheet.object
      this.workSheet.arrayOfObject.forEach((object) => {
        //* обновление ID
        let sourceId = ''
        if (new Hash(object.source).md5 == '9fcc5acecc1e69fad95aa3fec1b715c6' /*web3space*/) {
          sourceId = new Hash(object.name + '#' + object.symbol).uuid
        } else {
          const coinsKey = new Hash(object.source + object.name + object.symbol)
            .md5
          sourceId = coins[coinsKey]?.id || void 0
        }
        this.workSheet.insertValue(
          sourceId,
          object.rowNum,
          this.workSheet.head.sourceId.idx + 1
        )
      })
    } catch (error) {
      console.error('Symbols.updateId', error.stack)
    }
  }

  updatePrices() {
    new Promise((resolve, reject) => {
      const process = () => {
        /**
         * Обновление данных строки
         * @param {object} symbolObject
         * @param {number} price
         * @param {number} rank
         */
        const updatePricesRow = (
          symbolObject,
          price = void 0,
          rank = void 0
        ) => {
          new Promise((resolve) => {
            const process = () => {
              let coinMarketCapRankGroup = 'Not rank group'
              let coinPriceGroup = 'Not price group'
              let rankNumber
              //* определение группы по капитализации
              rank ? (rankNumber = rank * 1) : (rankNumber = 100000)
              if (rankNumber <= 50) {
                coinMarketCapRankGroup = 'Top 50'
              } else if (rankNumber > 50 && rankNumber <= 100) {
                coinMarketCapRankGroup = 'Top 100'
              } else if (rankNumber > 100 && rankNumber <= 200) {
                coinMarketCapRankGroup = 'Top 200'
              } else if (rankNumber > 200 && rankNumber <= 300) {
                coinMarketCapRankGroup = 'Top 300'
              } else if (rankNumber > 300 && rankNumber <= 400) {
                coinMarketCapRankGroup = 'Top 400'
              } else if (rankNumber > 400 && rankNumber <= 500) {
                coinMarketCapRankGroup = 'Top 500'
              } else if (rankNumber > 500 && rankNumber <= 1000) {
                coinMarketCapRankGroup = 'Top 1000'
              } else if (rankNumber > 1000 && rankNumber < 100000) {
                coinMarketCapRankGroup = 'Over 1000'
              }
              //* определение группы по цене

              if (price > 0 && price <= 1) {
                coinPriceGroup = 'Price 0-1'
              } else if (price > 1 && price <= 2) {
                coinPriceGroup = 'Price 1-2'
              } else if (price > 2 && price <= 4) {
                coinPriceGroup = 'Price 2-4'
              } else if (price > 4 && price <= 8) {
                coinPriceGroup = 'Price 4-8'
              } else if (price > 8 && price <= 16) {
                coinPriceGroup = 'Price 8-16'
              } else if (price > 16 && price <= 32) {
                coinPriceGroup = 'Price 16-32'
              } else if (price > 32 && price <= 64) {
                coinPriceGroup = 'Price 32-64'
              } else if (price > 64 && price <= 128) {
                coinPriceGroup = 'Price 64-128'
              } else if (price > 128 && price <= 256) {
                coinPriceGroup = 'Price 128-256'
              } else if (price > 256 && price <= 512) {
                coinPriceGroup = 'Price 256-512'
              } else if (price > 512) {
                coinPriceGroup = 'Over 512'
              }
              symbolObject.priceGroup = coinPriceGroup
              symbolObject.marketCapGroup = coinMarketCapRankGroup
              symbolObject.price = price
              symbolObject.update = new Date()
              return true
            }
            process() ? resolve() : reject(new Error('updatePricesRow'))
          }).catch((error) => {
            console.error('Symbols.updatePrices', error.stack)
          })
        }
        const listId = Object.fromEntries(
          Object.entries(
            this.workSheet.arrayOfObject.reduce((list, object) => {
              if (!list[object.source]) {
                list[object.source] = []
              }
              if (
                object.sourceId &&
                new Hash(object.source).md5 !==
                '8b9035807842a4e4dbe009f3f1478127' /*custom*/
              ) {
                list[object.source].push(object.sourceId)
              }
              else {
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
              const symbolKey = new Hash(coin.symbol).md5
              updatePricesRow(
                this.workSheet.object[symbolKey],
                coin?.current_price,
                coin?.market_cap_rank
              )
            })
          }
        }

        if (listId.web3space) {
          const priceArray = new web3Space.Price().getLastPrice(listId.web3space)
          if (priceArray.length) {
            priceArray.forEach((coin) => {
              const symbolKey = new Hash(coin?.token_id).md5
              console.log(coin?.price_close)
              console.log(this.workSheet.object[symbolKey])
              updatePricesRow(
                this.workSheet.object[symbolKey],
                coin?.price_close,
                0
              )
            })
          }
        }

        if (listId.cryptorank) {
          const priceArray = new cryptoRank.Price().getLastPrice(
            listId.cryptorank
          )

          if (priceArray.length) {
            priceArray.forEach((coin) => {
              const symbolKey = new Hash(coin?.symbol).md5
              updatePricesRow(
                this.workSheet.object[symbolKey],
                coin?.values?.USD?.price,
                coin?.rank
              )
            })
          }
        }

        if (listId.cryptocompare) {
          const priceArray = new cryptoCompare.Price().getMultiPrice(
            listId.cryptocompare
          )
          if (priceArray.length) {
            const marketCapRank = new cryptoCompare.TopList().topMarketCap(1000)
            priceArray.forEach((coin) => {
              const symbolKey = new Hash(coin.symbol).md5
              updatePricesRow(
                this.workSheet.object[symbolKey],
                coin?.price,
                marketCapRank[symbolKey]?.rank
              )
            })
          }
        }
        // if (listId.custom.length) {
        //   const transactions = new Transactions()
        //   listId.custom.forEach((symbol) => {
        //     const historicalPricesAvg =
        //       transactions.getHistoricalPriceBuy(
        //         new Date(),
        //         'ikeniborn (speculative)',
        //         symbol,
        //         true
        //       ) || void 0

        //     this.updatePrice(symbol, historicalPricesAvg)
        //     this.updateRisk(symbol)
        //   })
        // }
        return true
      }
      process() ? resolve() : reject(new Error('updatePrices'))
    })
      .then(this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject))
      .catch((error) => {
        console.error('Symbols.updatePrices', error.stack)
      })
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
