import { Analitics } from './ss/analitics'
import { FormatDate, FormatObject, Hash } from '../utils'
import * as cryptoCompare from '../restApi/cryptoCompare'
import * as coinGecko from '../restApi/coinGecko'

function test() {
  console.log(
    new FormatDate('2022-07-01').getDateBegin().getDateUTC().getListDates()
      .listDates
  )
}

/**
 *
 * @param {*} from
 * @param {*} to
 * @param {*} tokenASymbol
 * @param {*} tokenBSymbol
 * @param {*} tokenAId
 * @param {*} tokenBID
 */
function updateHistory(
  from,
  to,
  tokenASymbol,
  tokenBSymbol,
  tokenAId,
  tokenBID
) {
  let dateFrom, fromUnix, countDay
  const histories = new Analitics().getWorkSheet('history')
  dateFrom = new FormatDate(from).getDateBegin()
  const dateTo = new FormatDate(to).getDateBegin()

  fromUnix = dateFrom.unix
  const toUnix = dateTo.unix
  countDay = dateFrom.diffBetweenDate(dateTo.date) + 1

  if (countDay < 91) {
    countDay = 91
    dateFrom = new FormatDate(dateTo.date)
      .getDateBegin()
      .getPreviousDate(countDay)
    fromUnix = dateFrom.unix
  }

  const tokenAData = new coinGecko.Coins().getCoinsRange(
    tokenAId,
    'usd',
    fromUnix,
    toUnix
  )

  const tokenBData = new coinGecko.Coins().getCoinsRange(
    tokenBID,
    'usd',
    fromUnix,
    toUnix
  )

  const allData = new FormatDate(dateFrom.date)
    .getListDates(dateTo.date)
    .listDates.reduce((rowObject, date) => {
      const dateData = new FormatDate(date).getDateBegin()
      const dateKey = dateData.dateKey
      if (!rowObject[dateKey]) {
        rowObject[dateKey] = {
          dateKey: dateKey,
          dateString: dateData.date,
          dateValue: dateData.value,
          dateUnix: dateData.unix,
          date: dateData.getFormatDate('yyyy-MM-dd'),
          tokenATokenB: tokenASymbol + '/' + tokenBSymbol,
          tokenAPrice: tokenAData[dateKey]?.price,
          tokenBPrice: tokenBData[dateKey]?.price,
          coefPrice: void 0,
          lrCoefPrice: void 0,
          tokenAMarketCap: tokenAData[dateKey]?.marketCap,
          tokenBMarketCap: tokenBData[dateKey]?.marketCap,
          coefPriceMarketCap: void 0,
          tokenAVolume: tokenAData[dateKey]?.volume,
          tokenBVolume: tokenBData[dateKey]?.volume,
          coefVolume: void 0,
          lrCoefVolume: void 0,
        }
      }
      return rowObject
    }, {})

  const filterArrayOfObject = Object.values(allData).filter((rowObject) => {
    return (
      rowObject.tokenAPrice &&
      rowObject.tokenBPrice &&
      rowObject.tokenAMarketCap &&
      rowObject.tokenBMarketCap &&
      rowObject.tokenAVolume &&
      rowObject.tokenBVolume
      // rowObject.dateValue > new FormatDate(from).getDateBegin().value
    )
  })
  histories.truncateInsertRows(filterArrayOfObject)
}
/**
 * Расчет показателей
 * @param {string} fromMetric yyyy-mm-dd
 * @param {*} toMetric yyyy-mm-dd
 */
function calculateCoef(fromMetric, toMetric) {
  const dateFromMetric = new FormatDate(fromMetric).getDateBegin()
  const dateToMetric = new FormatDate(toMetric).getDateBegin()
  let dateUnixs, coefPrices, coefVolumes, coefMarketCaps, coefVolatilitys
  dateUnixs = []
  coefPrices = []
  coefVolumes = []
  coefMarketCaps = []
  coefVolatilitys = []

  const histories = new Analitics().getWorkSheet('history')

  const newHistories = histories.arrayOfObject.reduce((object, rowObject) => {
    if (!object[rowObject.dateKey]) {
      object[rowObject.dateKey] = rowObject
    }
    object[rowObject.dateKey].coefPrice =
      rowObject.tokenAPrice / rowObject.tokenBPrice
    object[rowObject.dateKey].coefVolume =
      rowObject.tokenAVolume / rowObject.tokenBVolume
    object[rowObject.dateKey].coefPriceMarketCap =
      rowObject.tokenAMarketCap / rowObject.tokenBMarketCap

    //* расчет волантильности
    object[rowObject.dateKey].tokenAVolatility =
      rowObject.tokenAVolume / rowObject.tokenAMarketCap
    object[rowObject.dateKey].tokenBVolatility =
      rowObject.tokenBVolume / rowObject.tokenBMarketCap
    object[rowObject.dateKey].coefVolatility =
      object[rowObject.dateKey].tokenAVolatility /
      object[rowObject.dateKey].tokenBVolatility

    if (
      rowObject.dateUnix >= dateFromMetric.unix &&
      rowObject.dateUnix <= dateToMetric.unix
    ) {
      dateUnixs.push(rowObject.dateUnix)
      coefPrices.push(object[rowObject.dateKey].coefPrice)
      coefVolumes.push(object[rowObject.dateKey].coefVolume)
      coefMarketCaps.push(object[rowObject.dateKey].coefPriceMarketCap)
      coefVolatilitys.push(object[rowObject.dateKey].coefVolatility)
    }
    return object
  }, {})

  //* расчет коэфициента цены
  const positiveArraydiffCoefPricestoLr = []
  const negativeArraydiffCoefPricestoLr = []
  const arraylrCoefPrices = []
  const lrCoefPrices = findLineByLeastSquares(dateUnixs, coefPrices)

  lrCoefPrices.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey
    newHistories[dateKey].lrCoefPrice = value
    arraylrCoefPrices.push(value)
    //* расчет отклонения от средней регресионной
    newHistories[dateKey].diffCoefPricestoLr =
      newHistories[dateKey].coefPrice - value
    if (newHistories[dateKey].diffCoefPricestoLr > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr.push(
        newHistories[dateKey].diffCoefPricestoLr
      )
    } else if (newHistories[dateKey].diffCoefPricestoLr < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr.push(
        newHistories[dateKey].diffCoefPricestoLr * -1
      )
    }
  })

  // const maxPositiveArraydiffCoefPricestoLr = positiveArraydiffCoefPricestoLr.reduce(
  //   (max, value) => {
  //     if (max < value) {
  //       max = value
  //     }
  //     return max
  //   },
  //   0
  // )
  // const minPositiveArraydiffCoefPricestoLr = positiveArraydiffCoefPricestoLr.reduce(
  //   (min, value) => {
  //     if (min > value) {
  //       min = value
  //     }
  //     return min
  //   },
  //   maxPositiveArraydiffCoefPricestoLr
  // )
  //* стандратное отклонение
  const stdevPositiveArraydiffCoefPricestoLr = getStandardDeviation(
    positiveArraydiffCoefPricestoLr
  )
  const stdevNegativeArraydiffCoefPricestoLr = getStandardDeviation(
    negativeArraydiffCoefPricestoLr
  )

  //* вариативность
  const varPositiveArraydiffCoefPricestoLr = calculateVariance(
    positiveArraydiffCoefPricestoLr
  )
  const varNegativeArraydiffCoefPricestoLr = calculateVariance(
    negativeArraydiffCoefPricestoLr
  )

  //* среднее
  const avgPositiveArraydiffCoefPricestoLr = calculateAvg(
    positiveArraydiffCoefPricestoLr
  )

  const avgNegativeArraydiffCoefPricestoLr = calculateAvg(
    positiveArraydiffCoefPricestoLr
  )

  //* коэффициент вариативности
  const coefVarPositiveArraydiffCoefPricestoLr =
    stdevPositiveArraydiffCoefPricestoLr / avgPositiveArraydiffCoefPricestoLr
  const coefVarNegativeArraydiffCoefPricestoLr =
    stdevNegativeArraydiffCoefPricestoLr / avgNegativeArraydiffCoefPricestoLr

  // //* расчет коэффициента объема
  // const lrCoefVolumes = findLineByLeastSquares(times, coefVolumes)
  // lrCoefVolumes.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   newHistories[dateKey].lrCoefVolume = value
  // })
  // //* расчет коэффициента капитализации
  // const lrcoefPriceMarketCaps = findLineByLeastSquares(times, coefMarketCaps)
  // lrcoefPriceMarketCaps.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   newHistories[dateKey].lrCoefPriceMarketCap = value
  // })
  // //* расчет коэффициента волантильности
  // const lrCoefVolatilitys = findLineByLeastSquares(times, coefVolatilitys)
  // lrCoefVolatilitys.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   newHistories[dateKey].lrCoefVolatility = value
  // })

  // arrayOfObject = Object.values(newHistories)
  // const arrayCoefPrices = arrayOfObject.map((m) => m.lrCoefPrice)
  // const arrayCoefVolumes = arrayOfObject.map((m) => m.lrCoefVolume)
  // const arrayCoefMarketCap = arrayOfObject.map((m) => m.lrCoefPriceMarketCap)
  // const arrayCoefVolatility = arrayOfObject.map((m) => m.lrCoefVolatility)
  // const lrFormula1 = linearRegression(arrayCoefPrices, arrayCoefVolumes)
  // const lrFormula2 = linearRegression(arrayCoefPrices, arrayCoefMarketCap)
  // const lrFormula3 = linearRegression(arrayCoefPrices, arrayCoefVolatility)
  // const lrFormula4 = linearRegression(arrayCoefMarketCap, arrayCoefVolumes)
  // const lrFormula5 = linearRegression(arrayCoefMarketCap, arrayCoefVolatility)
  // const lrFormula6 = linearRegression(arrayCoefVolumes, arrayCoefVolatility)
  // console.log('linearRegression(arrayCoefPrices, arrayCoefVolumes)', lrFormula1)
  // console.log(
  //   'linearRegression(arrayCoefPrices, arrayCoefMarketCap)',
  //   lrFormula2
  // )
  // console.log(
  //   'linearRegression(arrayCoefPrices, arrayCoefVolatility)',
  //   lrFormula3
  // )
  // console.log(
  //   'linearRegression(arrayCoefMarketCap, arrayCoefVolumes)',
  //   lrFormula4
  // )
  // console.log(
  //   'linearRegression(arrayCoefMarketCap, arrayCoefVolatility)',
  //   lrFormula5
  // )
  // console.log(
  //   'linearRegression(arrayCoefVolumes, arrayCoefVolatility)',
  //   lrFormula6
  // )
  const arrayOfObjectNewHistories = Object.values(newHistories)
  arrayOfObjectNewHistories.forEach((rowObject) => {
    if (rowObject.lrCoefPrice) {
      rowObject.lrCoefPriceHigh =
        rowObject.lrCoefPrice +
        stdevPositiveArraydiffCoefPricestoLr *
          (coefVarPositiveArraydiffCoefPricestoLr + 1)
      rowObject.stdevPositiveArraydiffCoefPricestoLr = stdevPositiveArraydiffCoefPricestoLr
      rowObject.varPositiveArraydiffCoefPricestoLr = varPositiveArraydiffCoefPricestoLr
      rowObject.avgPositiveArraydiffCoefPricestoLr = avgPositiveArraydiffCoefPricestoLr
      rowObject.coefVarPositiveArraydiffCoefPricestoLr = coefVarPositiveArraydiffCoefPricestoLr
      rowObject.lrCoefPriceLow =
        rowObject.lrCoefPrice -
        stdevNegativeArraydiffCoefPricestoLr *
          (coefVarNegativeArraydiffCoefPricestoLr + 1)

      rowObject.stdevNegativeArraydiffCoefPricestoLr = stdevNegativeArraydiffCoefPricestoLr
      rowObject.varNegativeArraydiffCoefPricestoLr = varNegativeArraydiffCoefPricestoLr
      rowObject.avgNegativeArraydiffCoefPricestoLr = avgNegativeArraydiffCoefPricestoLr
      rowObject.coefVarNegativeArraydiffCoefPricestoLr = coefVarNegativeArraydiffCoefPricestoLr
    }
  })

  histories.truncateInsertRows(Object.values(arrayOfObjectNewHistories))
}

function getStandardDeviation(array) {
  const n = array.length
  const mean = array.reduce((a, b) => a + b) / n
  return Math.sqrt(
    array.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n
  )
}

/**
 *  y = slope * x + intercept
 * @param {array} y
 * @param {array} x
 * @returns slope  , intercept , r2
 */
function linearRegression(y, x) {
  /*y = slope * x + intercept */
  var lr = { slope: void 0, intercept: void 0, r2: void 0 }
  var n = y.length
  var sum_x = 0
  var sum_y = 0
  var sum_xy = 0
  var sum_xx = 0
  var sum_yy = 0

  for (var i = 0; i < y.length; i++) {
    sum_x += x[i]
    sum_y += y[i]
    sum_xy += x[i] * y[i]
    sum_xx += x[i] * x[i]
    sum_yy += y[i] * y[i]
  }

  lr['slope'] = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x)
  lr['intercept'] = (sum_y - lr.slope * sum_x) / n
  lr['r2'] = Math.pow(
    (n * sum_xy - sum_x * sum_y) /
      Math.sqrt((n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y)),
    2
  )

  return lr
}

function findLineByLeastSquares(values_x, values_y) {
  var sum_x = 0
  var sum_y = 0
  var sum_xy = 0
  var sum_xx = 0
  var count = 0

  /*
   * We'll use those variables for faster read/write access.
   */
  var x = 0
  var y = 0
  var values_length = values_x.length

  if (values_length != values_y.length) {
    throw new Error(
      'The parameters values_x and values_y need to have same size!'
    )
  }

  /*
   * Nothing to do.
   */
  if (values_length === 0) {
    return [[], []]
  }

  /*
   * Calculate the sum for each of the parts necessary.
   */
  for (var v = 0; v < values_length; v++) {
    x = values_x[v]
    y = values_y[v]
    sum_x += x
    sum_y += y
    sum_xx += x * x
    sum_xy += x * y
    count++
  }

  /*
   * Calculate m and b for the formular:
   * y = x * m + b
   */
  var m = (count * sum_xy - sum_x * sum_y) / (count * sum_xx - sum_x * sum_x)
  var b = sum_y / count - (m * sum_x) / count

  /*
   * We will make the x and y result line now
   */
  // var result_values_x = []
  // var result_values_y = []
  const arrayOfArray = []

  for (var v = 0; v < values_length; v++) {
    x = values_x[v]
    y = x * m + b
    arrayOfArray.push([x, y])
    // result_values_x.push(x)
    // result_values_y.push(y)
  }

  // return [result_values_x, result_values_y]
  return arrayOfArray
}

function median(numbers) {
  const sorted = Array.from(numbers).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function quickselect_median(arr) {
  const L = arr.length,
    halfL = L / 2
  if (L % 2 == 1) return quickselect(arr, halfL)
  else return 0.5 * (quickselect(arr, halfL - 1) + quickselect(arr, halfL))
}

function quickselect(arr, k) {
  // Select the kth element in arr
  // arr: List of numerics
  // k: Index
  // return: The kth element (in numerical order) of arr
  if (arr.length == 1) return arr[0]
  else {
    const pivot = arr[0]
    const lows = arr.filter((e) => e < pivot)
    const highs = arr.filter((e) => e > pivot)
    const pivots = arr.filter((e) => e == pivot)
    if (k < lows.length)
      // the pivot is too high
      return quickselect(lows, k)
    else if (k < lows.length + pivots.length)
      // We got lucky and guessed the median
      return pivot
    // the pivot is too low
    else return quickselect(highs, k - lows.length - pivots.length)
  }
}

// Calculate the average of all the numbers
const calculateAvg = (values) => {
  const mean = values.reduce((sum, current) => sum + current) / values.length
  return mean
}

// Calculate variance (dispersion)
const calculateVariance = (values) => {
  const average = calculateAvg(values)
  const squareDiffs = values.map((value) => {
    const diff = value - average
    return diff * diff
  })
  const variance = calculateAvg(squareDiffs)
  return variance
}
