export { Coins }
import { WorkSheet } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'

class Coins {
  constructor() {
    this.head = new Portfolio().head
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.workSheet = new WorkSheet(this.spreadSheetName, 'coins')
    this.values = this.workSheet.getDimension(this.head.coins)
  }
}
