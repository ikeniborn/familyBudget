class Check {
  inString(where, what) {
    const we = where + ""
    const wt = what + ""
    if (we.toLowerCase().replace(/\s+/g, '').trim().match(wt.toLowerCase().replace(/\s+/g, '').trim())) {
      return true
    } else {
      return false
    }
  }
  isString(data) {
    return Object.prototype.toString.call(data) === '[object String]'
  }
}

class FormatDate {
  constructor(date = new Date(), timeZone = 'GMT+3') {
    this.date = new Date(date)
    this.timeZone = timeZone
  }
  get dt() {
    return Utilities.formatDate(new Date(this.date), this.timeZone, 'dd.MM.yyyy')
  }
  get dttm() {
    return Utilities.formatDate(new Date(this.date), this.timeZone, 'dd.MM.yyyy HH:mm')
  }
  get timestamp() {
    return Utilities.formatDate(new Date(this.date), this.timeZone, 'dd.MM.yyyy HH:mm:ss')
  }
  get str() {
    return JSON.stringify(this.date)
  }
  get year() {
    return this.date.getFullYear()
  }
  get month() {
    return this.date.getMonth() + 1
  }
  get day() {
    return this.date.getDate()
  }
  getTimeDiff() {
    const startDate = new Date()
    const tdiff = startDate.getTime() -  this.date.getTime()
    const str = timeToStr(tdiff)
    return str
  }
  timeToStr(tdiff) {
    let t = tdiff
    let ms = t % 1000;
    t -= ms;
    ms = Math.floor(ms / 10);
    t = Math.floor(t / 1000);
    let s = t % 60;
    t -= s;
    t = Math.floor(t / 60);
    let m = t % 60;
    t -= m;
    t = Math.floor(t / 60);
    let h = t % 60;
    if (h < 10) h = '0' + h;
    if (m < 10) m = '0' + m;
    if (s < 10) s = '0' + s;
    if (ms < 10) ms = '0' + ms;
    return h + ':' + m + ':' + s + '.' + ms;
  }
  getPreviousDate(day) {
    const startDate = new Date(this.date)
    startDate.setDate(this.date.getDate() - day)
    return startDate
  }
}

class FormatString{
  encodeData(data,symbol){
    const encodeSymbol = encodeURIComponent(symbol)
    const encodeData = encodeURIComponent(data)
    if(new Check().isString(encodeData,encodeSymbol)){
      return data.replace(symbol, encodeURIComponent(symbol))
    } else {
      return data
    }
  }
}

