export { Registry }
import { WorkSheetRange, WorkSheet } from '../../gas'
import { Hash } from '../../utils'
import { Portfolio } from '../spreadsheet/portfolio'

class Registry {
  constructor() {
    this.head = new Portfolio().head.registry
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.workSheet = new WorkSheet(this.spreadSheetName, 'registry', 1)
    this.values = this.workSheet.getFact(this.head)
  }

  /**
   *
   * @returns {array} Return array of object
   */
  getRegistryOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      'registry',
      1,
      range
    )
    return this.workSheetRange.rowNumArray.map((rowNum) => {
      const rowKey = new Hash(rowNum + this.workSheetRange.sheetName).md5
      const factRow = this.values[rowKey]
      factRow.rowKey = rowKey
      return factRow
    })
  }

  /**
   *
   * @returns {array} Return array of object
   */
  getRegistry() {
    return Object.values(new Registry().values)
  }

  // updateUsdPerCurrency(editRange) {
  //   this.eMap = new Map(Object.entries(editRange))
  //   if (this.eMap.has('range')) {
  //     if (
  //       this.eMap.get('range').columnStart === this.head.registry.currency.num
  //     ) {
  //       const rowNum = this.eMap.get('range').rowStart
  //       const rowIndex = rowNum - 2
  //       const rowValues = this.workSheet.dataValues.filter(
  //         (row, index) => index === rowIndex
  //       )[0]
  //       const currency = rowValues[this.head.registry.currency.idx]
  //       const time = new utils.FormatNumber(
  //         rowValues[this.head.registry.time.idx]
  //       ).getHourAndMinuteFromNumber()
  //       const dateTime = new utils.FormatDate(
  //         rowValues[this.head.registry.date.idx]
  //       ).addTime(time.h, time.m).date
  //       const price = new cryptoCompare.Price(
  //         cryptoCompareInstance
  //       ).getHistoryPrice(currency, dateTime)[currency.toUpperCase()].USD
  //       this.workSheet.portfolio.registry.insertValue(
  //         price,
  //         rowNum,
  //         this.head.registry.usdPerCurrency.num
  //       )
  //     }
  //   }
  // }
}
