import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Header } from '../../header'
export { HistoricalPrices }

class HistoricalPrices {
  constructor() {
    this.head = new Portfolio().head.historicalPrices
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.sheetName = 'HistoricalPrices'
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName)
    this.values = this.workSheet.getDimension(this.head)
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
        return rowArray.reduce((object, value, index) => {
          if (!object[headKey[index]]) {
            headKey[index] === 'rowKey'
              ? (object[headKey[index]] = rowKey)
              : (object[headKey[index]] = value)
          }
          object.rowNum = range.rowStart + indexRow
          return object
        }, {})
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

  getPreviousPrice(historicalPrices, date, coin, pair = 'usd') {
    const prevHistoricalPrice = Object.entries(this.values)
      .filter(([rowKey, row]) => {
        return new Hash(row.coin).md5 === new Hash(coin).md5
      })
      .reduce((lastPrice, [rowKey, row]) => {
        if (
          new FormatDate(row.date).yyyymmdd <= new FormatDate(date).yyyymmdd &&
          row.price
        ) {
          lastPrice = row.price
        }
        return lastPrice
      }, 0)
    console.log(date, coin, prevHistoricalPrice)
    return prevHistoricalPrice ? prevHistoricalPrice : void 0
  }
}
