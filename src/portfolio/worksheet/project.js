import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Header } from '../../header'
export { Project }

class Project {
  constructor() {
    this.head = new Portfolio().head.operations
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.sheetName = 'Project'
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
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head)
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
}
