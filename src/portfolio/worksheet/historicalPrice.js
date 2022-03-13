export { HistoricalPrice }
import { WorkSheet } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'

class HistoricalPrice {
  constructor() {
    this.head = new Portfolio().head
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.workSheet = new WorkSheet(this.spreadSheetName, 'historicalPrices')
    this.workSheet = this.workSheet.getDimension(this.head.historicalPrices)
  }
}
