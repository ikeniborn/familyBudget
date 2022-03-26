import { Portfolio } from '../spreadsheet/portfolio'
export { Project }

class Project {
  constructor(range) {
    this.workSheet = new Portfolio()
      .getWorkSheet('Project', range, 1)
      .getDimension()
    this.savePrimaryKeyChanges = this.workSheet.savePrimaryKeyChanges()
  }

  savePrimaryKeyChanges() {
    this.workSheet.savePrimaryKeyChanges()
  }
}
