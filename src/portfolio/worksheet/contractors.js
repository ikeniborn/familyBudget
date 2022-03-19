import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Header } from '../../header'
export { Contractors }

class Contractors {
  constructor() {
    this.head = new Portfolio().head.contractors
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.sheetName = 'Contractors'
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName)
    // this.values = this.workSheet.getDimension(this.head)
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
}
