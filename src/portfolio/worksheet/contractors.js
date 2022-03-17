import { WorkSheet } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
export { Contractors }

class Contractors {
  constructor() {
    this.head = new Portfolio().head.contractors
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.workSheet = new WorkSheet(this.spreadSheetName, 'contractors')
    this.values = this.workSheet.getDimension(this.head)
  }

  updateDimension() {
    const values = this.workSheet.updateDimension(this.head, this.values)
    this.workSheet.insertValues(
      values,
      new Portfolio().header.getHeaderAlias(this.head)
    )
  }
}
