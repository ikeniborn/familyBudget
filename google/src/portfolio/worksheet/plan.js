import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import { Symbols } from './symbols'
import { Transactions } from './transactions'
export { Plan }

class Plan {
  constructor(workSheet = '') {
    if (Plan.exists) {
      return Plan.instance
    }
    Plan.instance = this
    Plan.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Plan')
  }
}