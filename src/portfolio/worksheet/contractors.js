import { WorkSheet } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
export { Contractors }

class Contractors {
  constructor() {
    this.head = new Portfolio().head
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.workSheet = new WorkSheet(this.spreadSheetName, 'contractors')
    this.values = this.workSheet.getDimension(this.head.contractors)
  }
}
