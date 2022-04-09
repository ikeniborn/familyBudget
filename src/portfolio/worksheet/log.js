import { FormatDate } from '../../utils'
import { Portfolio } from '../spreadsheet/portfolio'
export { Log }

class Log {
  constructor() {
    if (Log.exists) {
      return Log.instance
    }
    Log.instance = this
    Log.exists = true
    this.workSheet = new Portfolio().getWorkSheet('Log')
  }
  /**
   * Добавление ошибки в реестр ошибок
   * @param {string} method Название метода
   * @param {string} error Текст ошибки
   */
  addError(method, error) {
    new Promise((resolve) => {
      this.workSheet.insertRow({
        dateTime: new FormatDate().getFormatDate('yyyy-MM-dd HH:mm:ss'),
        method,
        type: 'error',
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      })
      resolve()
    }).then(() => {
      this.truncateLog()
    })
  }
  /**
   * Добавление ошибки в реестр ошибок
   * @param {string} name Название метода
   * @param {string} error Текст ошибки
   */
  addMessage(method, name, message) {
    new Promise((resolve) => {
      const messageString =
        typeof message !== 'string' ? JSON.stringify(message) : message
      this.workSheet.insertRow({
        dateTime: new FormatDate().getFormatDate('yyyy-MM-dd HH:mm:ss'),
        method: method,
        type: 'message',
        name: name,
        message: messageString,
        stack: void 0,
      })
      resolve()
    }).then(() => {
      this.truncateLog()
    })
  }

  truncateLog() {
    if (this.workSheet.countRow > 25) {
      this.workSheet.deleteRow(2, 20)
    }
  }
}
