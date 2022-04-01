import { Portfolio } from '../spreadsheet/portfolio'
import { Log } from './log'
export { Transactions }

class Transactions {
  constructor(workSheet = '') {
    if (Transactions.exists) {
      return Transactions.instance
    }
    Transactions.instance = this
    Transactions.exists = true
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Transactions')
  }

  /**
   *
   * @param {array} arrayOfObject Массив транзакций
   * @param {boolean} isRange Признак обновления диапазона передаваемых данных
   */
  updateTransactions(arrayOfObject = [], isRange = false) {
    try {
      if (isRange) {
        arrayOfObject.forEach((tx) => {
          const oldRow = this.workSheet.object[tx.rowKey]
          if (oldRow?.rowKey) {
            tx.rowNum = oldRow.rowNum
            this.workSheet.updateRow(tx)
          } else {
            this.workSheet.insertRow(tx)
          }
        })
      } else {
        this.workSheet.truncateInsertRows(arrayOfObject)
      }
    } catch (error) {
      new Log().addError('Transactions.updateTransactions', error)
    }
  }
}
