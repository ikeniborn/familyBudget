import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Header } from '../../header'
import { Coins } from './coins'
import { Hash, FormatDate, FormatNumber } from '../../utils'
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
    this.coins = new Coins().values
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    )
    const primaryKeyIndex = new Header().getPrimaryKeyIndex(this.head)
    const headKey = Object.keys(this.head)
    this.arrayOfObject = this.workSheetRange.rangeOffsetValues.map(
      (rowArray, indexRow) => {
        const rowKey = new Header().getPrimaryKey(primaryKeyIndex, rowArray)
        const object = rowArray.reduce((object, value, index) => {
          if (!object[headKey[index]]) {
            headKey[index] === 'rowKey'
              ? (object[headKey[index]] = rowKey)
              : (object[headKey[index]] = value)
          }
          object.rowNum = range.rowStart + indexRow
          return object
        }, {})
        const coin = Object.values(this.coins).filter((row) => {
          return (
            new RegExp(object.name.toString().toLowerCase(), 'g').test(
              row.name.toString().toLowerCase()
            ) &&
            new Hash(object.source).md5 === new Hash(row.source).md5 &&
            new Hash(object.symbol).md5 === new Hash(row.symbol).md5
          )
        })[0]
        object.id = coin?.id || void 0
        return object
      }
    )
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum)
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
    if (new FormatDate(date).yyyymmdd === new FormatDate().yyyymmdd) {
      if (new Hash(source).md5 === new Hash('cryptorank').md5) {
        return new cryptoRank.Price().getLastPrice(id).reduce((price, data) => {
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
        return Object.values(new coinMarketCap.Price().getLastPrice(id)).reduce(
          (price, data) => {
            price = data.quote.USD.price
            return price
          },
          0
        )
      }
    } else {
      if (
        new Hash(source).md5 === new Hash('cryptocompare').md5 //&&
        // ['Stablecoin', 'fiat']
        //   .map((value) => new Hash(value).md5)
        //   .indexOf(new Hash(risk).md5) !== -1
      ) {
        return new cryptoCompare.Price().getHistoryPrice(id, date, convert)
      }
      return void 0
    }
  }
}
