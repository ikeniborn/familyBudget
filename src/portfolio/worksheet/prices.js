import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import * as cryptoRank from '../../restApi/cryptoRank'
import * as cryptoCompare from '../../restApi/cryptoCompare'
import * as coinMarketCap from '../../restApi/coinMarketCap'
import * as coinGecko from '../../restApi/coinGecko'
export { Prices }

class Prices {
  constructor(workSheet = '') {
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
      const coinRank = coinsArray.filter((row) => {
        return (
          new RegExp(object.name.toString().toLowerCase(), 'g').test(
            row.name.toString().toLowerCase()
          ) &&
          new Hash('cryptorank').md5 === new Hash(row.source).md5 &&
          new Hash(object.symbol).md5 === new Hash(row.symbol).md5
        )
      })[0]
      object.priceId = coinPrice?.id || void 0
      object.rankId = coinRank?.id || void 0
      return object
    })

    this.workSheet.arrayOfObject.forEach((object) => {
      console.log(object)
      this.workSheet.updateRow(object)
    })
  }

  getHistoricalPrice(account, project, date, symbol, convert = 'usd') {
    const coin = this.workSheet.object[new Hash(symbol).md5]
    const source = coin.source
    const id = coin.id
    const risk = coin.risk
    if (new Hash('Stablecoin').md5 !== new Hash(risk).md5) {
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
          const histirocalPrices = new HistoricalPrices().values
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
          if (object.priceId) {
            list[object.source].push(object.priceId)
          } else {
            list[object.source].push(object.symbol)
          }
          return list
        }, {})
      ).map(([source, idArray]) => [source, idArray.join(',')])
    )
    const updateRisk = (symbol, rank = '') => {
      const coin = this.workSheet.object[new Hash(symbol).md5]
      if (
        ['stablecoin', 'fiat']
          .map((value) => new Hash(value).md5)
          .indexOf(new Hash(coin.risk).md5) === -1
      ) {
        let rank_ = rank
        if (!rank_ && coin.rankId) {
          rank_ = new cryptoRank.Price().getRank(coin.rankId) || 5000
        } else {
          rank_ = 5000
        }
        if (rank_ < 10) {
          coin.risk = 'Top 10 (Very low)'
        } else if (rank_ < 50) {
          coin.risk = 'Top 50 (Low)'
        } else if (rank_ < 100) {
          coin.risk = 'Top 100 (Middle)'
        } else if (rank_ < 1000) {
          coin.risk = 'Top 1000 (High)'
        } else if (rank_ > 1000) {
          coin.risk = 'Top 5000 (Very High)'
        }
      }
    }

    const updatePrice = (symbol, price) => {
      if (price) {
        this.workSheet.object[new Hash(symbol).md5].price = price
      }
    }
    if (listId.cryptorank) {
      new cryptoRank.Price().getLastPrice(listId.cryptorank).forEach((coin) => {
        updatePrice(coin.symbol, coin.values.USD.price)
        updateRisk(coin.symbol, coin.rank)
      })
    }
    if (listId.coingecko) {
      new coinGecko.Price()
        .getMarketsPrice(listId.coingecko)
        .forEach((coin) => {
          updatePrice(coin.symbol, coin.current_price)
          updateRisk(coin.symbol, coin.market_cap_rank)
        })
    }
    if (listId.coinmarketcap) {
      Object.values(
        new coinMarketCap.Price().getLastPrice(listId.coinmarketcap)
      ).forEach((coin) => {
        updatePrice(coin.symbol, coin.quote.USD.price)
        updateRisk(coin.symbol, coin.cmc_rank)
      })
    }
    if (listId.cryptocompare) {
      new cryptoCompare.Price()
        .getMultiPrice(listId.cryptocompare)
        .forEach((coin) => {
          updatePrice(coin.symbol, coin.price)
          updateRisk(coin.symbol)
        })
    }
    if (listId.custom) {
      const histirocalPrices = new Portfolio().getWorkSheet('historicalPrices')
        .object
      this.workSheet.arrayOfObject
        .filter((row) => {
          return new Hash(row.source).md5 === new Hash('custom').md5
        })
        .forEach((object) => {
          const histirocalPricesKey = new Hash(
            'ikeniborn' + 'no project' + object.symbol
          ).md5
          const histirocalPrice =
            histirocalPrices[histirocalPricesKey]?.priceAvg || void 0
          this.workSheet.object[object.rowKey].price = histirocalPrice
        })
    }

    this.workSheet.truncateInsertRows(this.workSheet.arrayOfObject)
  }
}
