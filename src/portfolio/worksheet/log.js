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
    this.workSheet.insertRow({
      dateTime: new FormatDate().getFormatDate('yyyy-MM-dd HH:mm:ss'),
      method,
      type: 'error',
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    })
  }
  /**
   * Добавление ошибки в реестр ошибок
   * @param {string} name Название метода
   * @param {string} error Текст ошибки
   */
  addMessage(method, name, message) {
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
  }
}
