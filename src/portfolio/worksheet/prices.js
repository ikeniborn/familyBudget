import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Coins } from './coins'
import { Header } from '../../header'
import { Hash, FormatDate } from '../../utils'
import * as cryptoRank from '../../restApi/cryptoRank'
import * as cryptoCompare from '../../restApi/cryptoCompare'
import * as coinMarketCap from '../../restApi/coinMarketCap'
import * as coinGecko from '../../restApi/coinGecko'
export { Prices }

class Prices {
  constructor() {
    this.head = new Portfolio().head.prices
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.sheetName = 'Prices'
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName)
    this.values = this.workSheet.getDimension(this.head)
  }

  getOnEdit(range) {
    const coins = new Coins().values
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    )
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head)
    console.log(this.arrayOfObject)
    this.arrayOfObject.map((object) => {
      const coin = Object.values(coins).filter((row) => {
        return (
          new RegExp(object.name.toString().toLowerCase(), 'g').test(
            row.name.toString().toLowerCase()
          ) &&
          new Hash(object.source).md5 === new Hash(row.source).md5 &&
          new Hash(object.symbol).md5 === new Hash(row.symbol).md5
        )
      })[0]
      object.id = coin?.id || void 0
      object.isNotNull = new Header().isNotNull(this.head, object)
      object.isChangePrimaryKey = new Header().isChangePrimaryKey(
        this.head,
        object
      )
      return object
    })
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      if (object.isNotNull || object.isChangePrimaryKey) {
        this.workSheet.updateRow(object, this.head)
      }
    })
  }

  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert()
  }

  getPrice(date, symbol, convert = 'usd') {
    const coinRow = this.values[new Hash(symbol).md5]
    const source = coinRow.source
    const id = coinRow.id
    const risk = coinRow.risk
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
        if (new Hash(source).md5 === new Hash('cryptocompare').md5) {
          return new cryptoCompare.Price().getHistoryPrice(id, date, convert)
        }
      }
    } else {
      return 1
    }
  }

  updatePrices() {
    const listId = Object.fromEntries(
      Object.entries(
        Object.values(this.values).reduce((list, object) => {
          if (!list[object.source]) {
            list[object.source] = []
          }
          if (object.id) {
            list[object.source].push(object.id)
          }
          return list
        }, {})
      ).map(([source, idArray]) => [source, idArray.join(',')])
    )
    const updatePrice = (symbol, price, rank = '') => {
      const coin = this.values[new Hash(symbol).md5]
      if (price) {
        coin.price = price
      }
      if (
        ['stablecoin', 'fiat']
          .map((value) => new Hash(value).md5)
          .indexOf(new Hash(coin.risk).md5) === -1
      ) {
        if (!rank) {
          coin.risk = 'High'
        } else if (rank < 100) {
          coin.risk = 'Low'
        } else if (rank < 1000) {
          coin.risk = 'Middle'
        } else if (rank > 1000) {
          coin.risk = 'High'
        }
      }
    }
    const getCurrentPrice = () => {
      return new Promise((resolve) => {
        if (listId.cryptorank) {
          new cryptoRank.Price()
            .getLastPrice(listId.cryptorank)
            .forEach((coin) => {
              updatePrice(coin.symbol, coin.values.USD.price, coin.rank)
            })
        }
        if (listId.coingecko) {
          new coinGecko.Price()
            .getMarketsPrice(listId.coingecko)
            .forEach((coin) => {
              updatePrice(coin.symbol, coin.current_price, coin.market_cap_rank)
            })
        }
        if (listId.coinmarketcap) {
          Object.values(
            new coinMarketCap.Price().getLastPrice(listId.coinmarketcap)
          ).forEach((coin) => {
            updatePrice(coin.symbol, coin.quote.USD.price, coin.cmc_rank)
          })
        }
        if (listId.cryptocompare) {
          new cryptoCompare.Price()
            .getMultiPrice(listId.cryptocompare)
            .forEach((coin) => {
              updatePrice(coin.symbol, coin.price, 100)
            })
        }
        resolve()
      })
    }
    getCurrentPrice().then(() => {
      this.workSheet.insertRows(Object.values(this.values), this.head)
    })
  }
}
