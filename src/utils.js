export { FormatNumber, Hash, FormatDate, FormatObject, FormatArray }

class Hash {
  /**
   *
   * @param {string} string
   */
  constructor(string) {
    typeof string === 'string'
      ? (this.stringLowerCase = string.toLowerCase())
      : (this.stringLowerCase = (string + '').toString().toLowerCase())
    this.stringUpperCase = this.stringLowerCase.toUpperCase()
  }

  get md5() {
    let hexstr = ''
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      this.stringLowerCase.replace(/[\s+]+$|^[\s+]+/g, '').trim()
    )
    for (let i = 0; i < digest.length; i++) {
      var val = (digest[i] + 256) % 256
      hexstr += ('0' + val.toString(16)).slice(-2)
    }
    return hexstr
  }

  get uuid() {
    const uuidRx = new RegExp(/([a-zA-Z0-9]{8})([a-zA-Z0-9]{4})([a-zA-Z0-9]{4})([a-zA-Z0-9]{4})([a-zA-Z0-9]{12})/)
    return this.md5.replace(uuidRx, "$1-$2-$3-$4-$5")
  }

  uuidToMd5 (){
    return this.stringLowerCase.replace(/[-+]/g, '')
  }
}

class FormatDate {
  /**
   * Форматирование и преобразование даты
   * @param {date} date значение даты. По умолчанию - текущее значение
   * @param {object} options Часовой пояс и признак Timestamp. По умолчанию - GMT+3 , Timestamp = true
   */
  constructor(date = new Date(), timeZone = 'GMT+3') {
    this.date = new Date(date)
    this.timeZone = timeZone
  }

  getDateBegin() {
    this.date = new Date(
      this.date.getFullYear(),
      this.date.getMonth(),
      this.date.getDate(),
      0,
      0,
      0,
      0
    )
    return this
  }

  /**
   * Дата в формате dd.MM.yyyy
   */
  getFormatDate(format = 'dd.MM.yyyy') {
    return Utilities.formatDate(new Date(this.date), this.timeZone, format)
  }
  /**
   * Значение даты в формате строки
   */
  get string() {
    return JSON.stringify(this.date)
  }
  /**
   * Значение даты в формате строки
   */
  get md5() {
    return new Hash(this.yyyymmdd).md5
  }

  /**
   * Год в числовой формате YYYY
   */
  get year() {
    return this.date.getFullYear()
  }
  /**
   * Месяц
   */
  get month() {
    return this.date.getMonth() + 1
  }
  /**
   * День недели
   */
  get weekDay() {
    return this.date.getDay() + 1
  }
  /**
   * День месяца
   */
  get monthDay() {
    return this.date.getDate()
  }
  /**
   * Дата в формате числа YYYYMMDD
   */
  get yyyymmdd() {
    const year = this.date.getFullYear() + ''
    let month = this.date.getMonth() + 1 + ''
    let day = this.date.getDate() + ''
    month.toString().length === 1 ? (month = '0' + month) : (month = month)
    day.toString().length === 1 ? (day = '0' + day) : (day = day)
    return year + month + day
  }
  /**
   * Дата в формате числа YYYYMM
   */
  get yyyymm() {
    const year = this.date.getFullYear() + ''
    let month = this.date.getMonth() + 1 + ''
    month.toString().length === 1 ? (month = '0' + month) : (month = month)
    return year + month
  }

  /**
   * Номер недели по стандурту ISO
   */
  get week() {
    return this.date.getISOWeek()
  }

  get unix() {
    return Math.round(this.date.valueOf() / 1000)
  }

  get value() {
    return new Date(this.date).valueOf()
  }

  get dateKey() {
    return new Hash(this.value).md5
  }

  /**
   * Преобразование даты в числовом виде в дату
   * @param {number} YYYYMMDD дата в числовом формате
   * @returns
   */
  getDateFromYYYYMMDD(YYYYMMDD = 19700101) {
    const year = YYYYMMDD.substr(0, 4) * 1
    const month = YYYYMMDD.substr(4, 2) * 1 - 1
    const day = YYYYMMDD.substr(6, 2) * 1
    this.date = new Date(year, month, day)
    return this
  }

  addTime(h = 0, m = 0) {
    this.date = new Date(this.year, this.month - 1, this.monthDay, h, m)
    return this
  }
  /**
   * РАсчет длительности от указанной и текущей даты
   * @returns разница во времени в формате hh:mm:ss.ms
   */
  getTimeDiff() {
    const endDate = new Date()
    const tdiff = endDate.getTime() - this.date.getTime()
    const str = this.timeToStr(tdiff)
    return str
  }
  /**
   * Приведение времени к формату hh:mm:ss.ms
   * @param {number} time время в числовом формате
   * @returns время в формате hh:mm:ss.ms
   */
  timeToStr(time) {
    let t = time
    let ms = t % 1000
    t -= ms
    ms = Math.floor(ms / 10)
    t = Math.floor(t / 1000)
    let s = t % 60
    t -= s
    t = Math.floor(t / 60)
    let m = t % 60
    t -= m
    t = Math.floor(t / 60)
    let h = t % 60
    if (h < 10) h = '0' + h
    if (m < 10) m = '0' + m
    if (s < 10) s = '0' + s
    if (ms < 10) ms = '0' + ms
    return h + ':' + m + ':' + s + '.' + ms
  }

  /**
   * Получение прошлой даты на заданное количество дней
   * @param {number} day количество дней
   * @returns Дата
   */
  getPreviousDate(day) {
    const startDate = new Date(this.date)
    this.date = new Date(startDate.setDate(this.date.getDate() - day))
    return this
  }

  /**
   * Получение будущей даты на заданное количество дней
   * @param {number} day количество дней
   * @returns Дата
   */
  getNextDate(day) {
    const startDate = new Date(this.date)
    this.date = new Date(startDate.setDate(this.date.getDate() - day))
    return this
  }

  /**
   * Расчет количества дней между двух дат. Даты приводятся к началу дню.
   * @param {date} endDate - Дата окончания. По умолчанию: текущая дата
   * @returns Количество полных дней
   */
  diffBetweenDate(endDate = new Date()) {
    const strtdt = this.date.getDateBegin()
    const enddt = new FormatDate(endDate).getDateBegin().date
    if (new Date(strtdt).getFullYear() > 2000) {
      const diff = Math.round(
        (enddt.getTime() - strtdt.getTime()) / (24 * 3600 * 1000)
      )
      return isNaN(diff) ? 0 : diff
    } else {
      return 0
    }
  }

  getListDates(endDate = new Date()) {
    const enddt = new FormatDate(endDate).date
    const countDay = this.diffBetweenDate(enddt) + 1
    this.listDates = [...Array(countDay).keys()].map(
      (m) =>
        (m = new FormatDate(
          new Date(enddt.setDate(enddt.getDate() - 1))
        ).getDateBegin().date)
    )
    return this
  }
}

//* Get start date
Date.prototype.getDateBegin = function () {
  const sourceDate = new Date(this)
  const tmzn = 'Europe/Moscow'
  ScriptApp.get
  const strDate = Utilities.formatDate(
    sourceDate,
    tmzn,
    'MMMM dd, yyyy 00:00:00 Z'
  )
  return new Date(strDate)
}

Date.prototype.getDateBeginUTC = function () {
  const sourceDate = new Date(this)
  const tmzn = 'UTC'
  ScriptApp.get
  const strDate = Utilities.formatDate(
    sourceDate,
    tmzn,
    'MMMM dd, yyyy 00:00:00 Z'
  )
  return new Date(strDate)
}
class FormatNumber {
  constructor(number = 0) {
    this.number = typeof string === 'number' ? number : number * 1
  }

  /**
   * Преобразование даты в числовом формате YYYYMMDD в тип дата
   *
   * @returns {date} Дата
   */
  getDate() {
    const numberString = this.number.toString()
    const year = numberString.substr(0, 4) * 1
    const month = numberString.substr(4, 2) * 1 - 1
    const day = numberString.substr(6, 2) * 1
    return new Date(year, month, day)
  }

  getHourAndMinuteFromNumber() {
    let t = this.number.toString()
    let h
    let m
    if (t.toString().length === 4) {
      h = t.toString().slice(0, 2) * 1
      m = t.toString().slice(2, 4) * 1
    } else if (t.toString().length === 3) {
      h = t.toString().slice(0, 1) * 1
      m = t.toString().slice(1, 3) * 1
    }
    if (t.toString().length === 2) {
      h = 0
      m = t * 1
    }
    return {
      h,
      m,
    }
  }
}

Object.prototype.isEmpty = function () {
  if (Object.keys(this).length === 0) {
    return true
  }
  return false
}

class FormatObject {
  constructor(object = {}) {
    this.object = object
  }
  getCopy() {
    return JSON.parse(JSON.stringify(this.object))
  }
}

class FormatArray {
  constructor(array = []) {
    this.array = array
  }
  getCopy() {
    return JSON.parse(JSON.stringify(this.array))
  }
}

String.prototype.isEmpty = function () {
  if (Object.values(this).every((value) => value === '')) {
    return true
  }
  return false
}
