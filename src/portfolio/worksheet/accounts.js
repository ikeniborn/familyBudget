import { Portfolio } from '../spreadsheet/portfolio'
export { Accounts }

class Accounts {
  constructor(range) {
    this.workSheet = new Portfolio()
      .getWorkSheet('Accounts', range, 1)
      .getDimension()
  }
  savePrimaryKeyChanges() {
    this.workSheet.savePrimaryKeyChanges()
  }
}
