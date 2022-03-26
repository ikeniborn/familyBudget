import { Portfolio } from '../spreadsheet/portfolio'
export { Services }

class Services {
  constructor(range) {
    this.workSheet = new Portfolio()
      .getWorkSheet('Services', range, 1)
      .getDimension()
    this.savePrimaryKeyChanges = this.workSheet.savePrimaryKeyChanges()
  }

  savePrimaryKeyChanges() {
    this.workSheet.savePrimaryKeyChanges()
  }
}
