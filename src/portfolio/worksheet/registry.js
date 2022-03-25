export { Registry }
import { WorkSheetRange, WorkSheet } from '../../gas'
import { Hash } from '../../utils'
import { Header } from '../../header'
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
      const isNotNull = new Header().isNotNull(this.head, factRow)
      return isNotNull ? factRow : []
    })
  }

  /**
   *
   * @returns {array} Return array of object
   */
  getRegistry() {
    return Object.values(new Registry().values)
  }
}
