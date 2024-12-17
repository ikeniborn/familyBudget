import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate } from '../../utils'
import { Symbols } from './symbols'
export { PlanFlow }

class PlanFlow {
  constructor(workSheet = '') {
    if (PlanFlow.exists) {
      return Plan.instance
    }
    PlanFlow.instance = this
    PlanFlow.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('PlanFlow')
  }
}