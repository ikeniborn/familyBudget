import { Portfolio } from '../spreadsheet/portfolio'
export { Operations }

class Operations {
  constructor(range) {
    this.workSheet = new Portfolio()
      .getWorkSheet('Operations', range, 1)
      .getDimension()
  }
  savePrimaryKeyChanges() {
    this.workSheet.savePrimaryKeyChanges()
  }
}
