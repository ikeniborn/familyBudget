import { Portfolio } from '../spreadsheet/portfolio'
export { Contractors }

class Contractors {
  constructor(range) {
    this.workSheet = new Portfolio()
      .getWorkSheet('Contractors', range, 1)
      .getDimension()
  }
  savePrimaryKeyChanges() {
    this.workSheet.savePrimaryKeyChanges()
  }
}
