class Hash {
  constructor(string) {
    this.string = typeof string === 'string' ? string : string + ''
  }

  get md5() {
    let hexstr = ''
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      this.string
        .toLowerCase()
        .toString()
        .replace(/[$+\s+]/g, '_')
        .trim()
    )
    for (let i = 0; i < digest.length; i++) {
      var val = (digest[i] + 256) % 256
      hexstr += ('0' + val.toString(16)).slice(-2)
    }
    return hexstr
  }
}

class DateFormat {
  /**
   * Форматирование и преобразование даты
   * @param {date} date значение даты. По умолчанию - текущее значение
   * @param {string} timeZone часовой пояс в формате GMT. По умолчанию - GMT+3
   */
  constructor(date = new Date(), timeZone = 'GMT+3') {
    this.date = new Date(date)
    this.timeZone = timeZone
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
  get str() {
    return JSON.stringify(this.date)
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
    startDate.setDate(this.date.getDate() - day)
    return startDate
  }

  /**
   * Расчет количества дней между двух дат. Даты приводятся к началу дню.
   * @param {date} endDate - Дата окончания
   * @returns Количество полных дней
   */
  diffBetweenDate(endDate) {
    const strtdt = this.date.getDateBegin()
    const enddt = new Date(endDate).getDateBegin()
    if (new Date(strtdt).getFullYear() > 2000) {
      const diff = Math.round(
        (strtdt.getTime() - enddt.getTime()) / (24 * 3600 * 1000)
      )
      return isNaN(diff) ? 0 : diff
    } else {
      return 0
    }
  }
}

class FormatNumber {
  constructor(number) {
    this.number = typeof string === 'number' ? number : number * 1
  }

  /**
   * Преобразование даты в числовом формате YYYYMMDD в тип дата
   *
   * @returns {date} Дата
   */
  getDate() {
    const year = this.number.substr(0, 4) * 1
    const month = this.number.substr(4, 2) * 1 - 1
    const day = this.number.substr(6, 2) * 1
    return new Date(year, month, day)
  }
}
