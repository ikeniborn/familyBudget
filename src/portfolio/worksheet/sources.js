import { Portfolio } from '../spreadsheet/portfolio'
export { Sources }

class Sources {
  constructor(range) {
    this.workSheet = new Portfolio()
      .getWorkSheet('Sources', range, 1)
      .getDimension()
    this.savePrimaryKeyChanges = this.workSheet.savePrimaryKeyChanges()
  }
  savePrimaryKeyChanges() {
    this.workSheet.savePrimaryKeyChanges()
  }
}
