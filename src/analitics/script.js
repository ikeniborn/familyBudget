import { Analitics } from './ss/analitics'
import { FormatDate, Hash } from '../utils'
import * as cryptoCompare from '../restApi/cryptoCompare'
import * as coinGecko from '../restApi/coinGecko'

function testGetData() {
  const fromUnix = new FormatDate().getPreviousDate(91).unix
  const toUnix = new FormatDate().unix

  const resp = new coinGecko.Coins().getCoinsRange(
    'bitcoin',
    'usd',
    fromUnix,
    toUnix
  )
  console.log(resp)
}

function updateHistory() {
  const histories = new Analitics().getWorkSheet('history')
  const countDay = new FormatDate().diffBetweenDate(new Date(2022, 3, 4))
  const fromUnix = new FormatDate(new Date(2022, 3, 3)).unix
  const toUnix = new FormatDate().unix
  const object = {}
  const tokenASymbol = 'dot'
  const tokenBSymbol = 'atom'
  const tokenAData = new cryptoCompare.Historical().histoday(
    tokenASymbol,
    'usd',
    countDay
  )

  const tokenAMarketCap = new coinGecko.Coins().getCoinsRange(
    'polkadot',
    'usd',
    fromUnix,
    toUnix
  )

  const tokenBData = new cryptoCompare.Historical().histoday(
    tokenBSymbol,
    'usd',
    countDay
  )

  const tokenBMarketCap = new coinGecko.Coins().getCoinsRange(
    'cosmos',
    'usd',
    fromUnix,
    toUnix
  )

  tokenAData.forEach((rowObject) => {
    const dataKey = new Hash(rowObject.time).md5
    if (!object[dataKey]) {
      object[dataKey] = {
        dateKey: dataKey,
        date: new FormatDate(new Date(rowObject.time * 1000)).getFormatDate(
          'yyyy-MM-dd'
        ),
        dateUnix: rowObject.time,
        tokenATokenB: tokenASymbol + '/' + tokenBSymbol,
        tokenBPrice: void 0,
        tokenAPrice: rowObject.close * 1,
        coefPrice: void 0,
        lrCoefPrice: void 0,
        tokenAMarketCap: tokenAMarketCap[dataKey]?.marketCap,
        tokenBMarketCap: tokenBMarketCap[dataKey]?.marketCap,
        coefPriceMarketCap: void 0,
        tokenBVolume: void 0,
        tokenAVolume: rowObject.volumeto,
        coefVolume: void 0,
        lrCoefVolume: void 0,
      }
    }
  })

  tokenBData.forEach((rowObject) => {
    const dataKey = new Hash(rowObject.time).md5
    object[dataKey].tokenBPrice = rowObject.close * 1
    object[dataKey].tokenBVolume = rowObject.volumeto
  })
  histories.truncateInsertRows(Object.values(object))
}

function calculateCoef() {
  let times, coefPrices, coefVolumes, coefMarketCaps
  times = []
  coefPrices = []
  coefVolumes = []
  coefMarketCaps = []
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
      object[rowObject.dateKey].tokenAMarketCap / rowObject.tokenBMarketCap
    times.push(rowObject.dateUnix)
    coefPrices.push(rowObject.coefPrice)
    coefVolumes.push(rowObject.coefVolume)
    coefMarketCaps.push(rowObject.coefPriceMarketCap)
    return object
  }, {})

  const lrCoefPrices = findLineByLeastSquares(times, coefPrices)
  lrCoefPrices.forEach(([time, value]) => {
    const dateKey = new Hash(time).md5
    newHistories[dateKey].lrCoefPrice = value
  })

  const lrCoefVolumes = findLineByLeastSquares(times, coefVolumes)
  lrCoefVolumes.forEach(([time, value]) => {
    const dateKey = new Hash(time).md5
    newHistories[dateKey].lrCoefVolume = value
  })

  const lrcoefPriceMarketCaps = findLineByLeastSquares(times, coefMarketCaps)
  lrcoefPriceMarketCaps.forEach(([time, value]) => {
    const dateKey = new Hash(time).md5
    newHistories[dateKey].lrcoefPriceMarketCap = value
  })
  arrayOfObject = Object.values(newHistories)
  const arrayCoefPrices = arrayOfObject.map((m) => m.lrCoefPrice)
  const arrayCoefVolumes = arrayOfObject.map((m) => m.lrCoefVolume)
  const arrayCoefMarketCap = arrayOfObject.map((m) => m.lrCoefVolume)
  const lrFormula1 = linearRegression(arrayCoefPrices, arrayCoefVolumes)
  const lrFormula2 = linearRegression(arrayCoefPrices, arrayCoefMarketCap)
  const lrFormula3 = linearRegression(arrayCoefVolumes, arrayCoefMarketCap)
  console.log('linearRegression(arrayCoefPrices, arrayCoefVolumes)', lrFormula1)
  console.log(
    'linearRegression(arrayCoefPrices, arrayCoefMarketCap)',
    lrFormula2
  )
  console.log(
    'linearRegression(arrayCoefVolumes, arrayCoefMarketCap)',
    lrFormula3
  )
  histories.truncateInsertRows(Object.values(newHistories))
}

function updateData() {
  new Promise((resolve) => {
    updateHistory()
    resolve()
  }).then(calculateCoef())
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
