import { Portfolio } from '../spreadsheet/portfolio'
import { Hash } from '../../utils'
import * as cryptoRank from '../../restApi/cryptoRank'
import * as cryptoCompare from '../../restApi/cryptoCompare'
// import * as coinMarketCap from '../../restApi/coinMarketCap'
import * as coinGecko from '../../restApi/coinGecko'
export { Coins }

class Coins {
  constructor(workSheet = '') {
    if (Coins.exists) {
      return Coins.instance
    }
    Coins.instance = this
    Coins.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Coins')
  }

  updateCoins() {
    new Promise((resolve, reject) => {
      const process = () => {
        const coins = []
        new coinGecko.CoinsList().getCoinsList().forEach((coin) => {
          const rowKey = new Hash('coingecko' + coin.name + coin.symbol).md5
          coins.push({
            rowKey: rowKey,
            source: 'coingecko',
            name: coin.name,
            symbol: coin.symbol,
            id: coin.id,
          })
        })

        new cryptoRank.CoinsList().getCoinsList(15000).forEach((coin) => {
          const key = new Hash('cryptorank' + coin.name + coin.symbol)
          coins.push({
            rowKey: key.md5,
            source: 'cryptorank',
            name: coin.name,
            symbol: coin.symbol,
            id: coin.id,
          })
        })

        Object.entries(new cryptoCompare.CoinsList().getCoinsList()).forEach(
          (coin) => {
            const key = new Hash('cryptocompare' + coin[1].CoinName + coin[0])
            coins.push({
              rowKey: key.md5,
              source: 'cryptocompare',
              name: coin[1].CoinName,
              symbol: coin[1].Symbol,
              id: coin[0],
            })
          }
        )
        const currency = [
          ['USA dollar', 'USD'],
          ['Russian rubble', 'RUB'],
          ['Euro', 'EUR'],
        ]
        currency.forEach((coin) => {
          const key = new Hash('cryptocompare' + coin[0] + coin[1])
          coins.push({
            rowKey: key.md5,
            source: 'cryptocompare',
            name: coin[0],
            symbol: coin[1],
            id: coin[1],
          })
        })

        return { result: true, array: coins }
      }
      const data = process()
      data.result ? resolve(data.array) : reject(new Error('updateCoins'))
    })
      .then((array) => {
        this.workSheet.truncateInsertRows(array)
      })
      .catch((error) => {
        console.error('Coins.updateCoins', error.stack)
      })
  }
}

//* Deprecated
// new coinMarketCap.CoinsList().getCoinsList().forEach((coin) => {
//   const key = new Hash('coinmarketcap' + coin.name + coin.symbol)
//   coins.push({
//     rowKey: key.md5,
//     source: 'coinmarketcap',
//     name: coin.name,
//     symbol: coin.symbol,
//     id: coin.id,
//   })
// })
