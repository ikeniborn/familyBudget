export { Registry }
import { WorkSheet } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'

class Registry {
  constructor() {
    this.head = new Portfolio().head
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.workSheet = new WorkSheet(this.spreadSheetName, 'registry', 1)
    this.values = this.workSheet.getFact(this.head.registry)
  }

  getRow(editRange) {
    this.eMap = new Map(Object.entries(editRange))
    const rowNum = this.eMap.get('range').rowStart
    const rowValues = this.values[rowNum]
    const oldRowHash = this.workSheet.metadata.getRowKey(rowNum)
    const isNewRow = oldRowHash !== rowValues.rowHash ? true : false
    if (isNewRow) {
      this.workSheet.metadata.addRowKey(rowNum, rowValues.rowHash)
    }
    return rowValues
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
