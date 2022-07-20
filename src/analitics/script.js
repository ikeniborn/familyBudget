import { Analitics } from './ss/analitics'
import { FormatDate, FormatObject, Hash } from '../utils'
import * as cryptoCompare from '../restApi/cryptoCompare'
import * as coinGecko from '../restApi/coinGecko'
import { ModalDialog } from '../gas'

function updateOnEdit(editRange) {
  const lock = LockService.getScriptLock()
  new Promise((resolve, reject) => {
    const workSheet = new Analitics().updateOnEdit(editRange.range)
    if (workSheet.isChangeData) {
      const startLock = new FormatDate()
      lock.tryLock(180000)
      workSheet.lockTime = startLock.getTimeDiff()
      if (workSheet.isChangePrimaryKey) {
        workSheet.savePrimaryKeyChanges()
      }

      resolve(workSheet)
    } else {
      reject(workSheet)
    }
  })
    .then((workSheet) => {
      console.info('script.updateOnEdit.lockTime', workSheet.lockTime)
      lock.releaseLock()
    })
    .catch((workSheet) => {
      console.error('script.updateOnEdit', workSheet.sheetName)
      lock.releaseLock()
    })
}

function showAlert(message) {
  new ModalDialog().alert(message)
}

/**
 *
 * @param {*} from
 * @param {*} to
 * @param {*} tokenAId
 * @param {*} tokenBId
 */
function updateHistory(from, to, tokenAId, tokenBId) {
  const lock = LockService.getScriptLock()
  lock.tryLock(180000)
  let dateFrom, fromUnix, countDay
  const histories = new Analitics().getWorkSheet('history')
  const tokenATokenBData = new Hash(tokenAId + '/' + tokenBId)
  const historiesOtherData = histories.arrayOfObject.filter((rowObject) => {
    return rowObject.tokenATokenBKey !== tokenATokenBData.md5
  })
  const historiesObject = histories.arrayOfObject
    .filter((rowObject) => {
      return rowObject.tokenATokenBKey === tokenATokenBData.md5
    })
    .reduce((object, rowObject) => {
      if (!object[rowObject.dateKey]) {
        object[rowObject.dateKey] = rowObject
      }
      return object
    }, {})

  dateFrom = new FormatDate(from).getDateBegin()
  const dateTo = to
    ? new FormatDate(to).getDateBegin()
    : new FormatDate(new Date()).getDateBegin()

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
    tokenBId,
    'usd',
    fromUnix,
    toUnix
  )

  const newData = new FormatDate(dateFrom.date)
    .getListDates(dateTo.date)
    .listDates.reduce((arrayOfObject, date) => {
      const dateData = new FormatDate(date).getDateBegin()
      const dateKey = dateData.dateKey
      if (tokenAData[dateKey]?.price && tokenBData[dateKey]?.price) {
        arrayOfObject.push({
          dateKey: dateKey,
          dateString: dateData.date,
          dateValue: dateData.value,
          dateUnix: dateData.unix,
          date: dateData.getFormatDate('yyyy-MM-dd'),
          tokenATokenB: tokenATokenBData.stringLowerCase,
          tokenATokenBKey: tokenATokenBData.md5,
          tokenAPrice: tokenAData[dateKey]?.price,
          tokenBPrice: tokenBData[dateKey]?.price,
          coefPrice: tokenAData[dateKey]?.price / tokenBData[dateKey]?.price,
          tokenAMarketCap: tokenAData[dateKey]?.marketCap,
          tokenBMarketCap: tokenBData[dateKey]?.marketCap,
          coefPriceMarketCap:
            tokenAData[dateKey]?.marketCap / tokenBData[dateKey]?.marketCap,
          tokenAVolume: tokenAData[dateKey]?.volume,
          tokenBVolume: tokenBData[dateKey]?.volume,
          coefVolume: tokenAData[dateKey]?.volume / tokenBData[dateKey]?.volume,
        })
      }

      return arrayOfObject
    }, [])

  newData.forEach((rowObject) => {
    if (!historiesObject[rowObject.dateKey]) {
      historiesObject[rowObject.dateKey] = rowObject
    }
  })

  const updateArrayOfObject = Object.values(historiesObject).sort((a, b) => {
    return a.dateValue - b.dateValue
  })

  histories.truncateInsertRows([...historiesOtherData, ...updateArrayOfObject])

  lock.releaseLock()
  return updateArrayOfObject.length ? true : false
}

function updateСhannel(channelKey) {
  const lock = LockService.getScriptLock()
  lock.tryLock(180000)
  const channel = new Analitics().getWorkSheet('overflowList').object[
    channelKey
  ]
  // const tokenATokenBKey =
  const histories = new Analitics().getWorkSheet('history')
  const historiesHistory = new Analitics().getWorkSheet('history')

  console.log()
}
/**
 *
 * @param {*} fromMetric yyyy-mm-dd
 * @param {*} toMetric yyyy-mm-dd
 * @param {*} tokenAId
 * @param {*} tokenBId
 */
function calculateCoef(fromMetric, toMetric, tokenAId, tokenBId) {
  const lock = LockService.getScriptLock()
  lock.tryLock(180000)
  let dateUnixs,
    coefPrices,
    // dateUnixs3d,
    // coefPrices3d,
    // dateUnixs7d,
    // coefPrices7d,
    dateUnixs30d,
    coefPrices30d,
    dateUnixs60d,
    coefPrices60d,
    dateUnixs90d,
    coefPrices90d,
    dateToMetric0dUnix,
    // dateFromMetric3dUnix,
    // dateFromMetric7dUnix,
    dateFromMetric30dUnix,
    dateFromMetric60dUnix,
    dateFromMetric90dUnix
  //  coefVolumes, coefMarketCaps, coefVolatilitys
  dateUnixs = []
  coefPrices = []
  // dateUnixs3d = []
  // coefPrices3d = []
  // dateUnixs7d = []
  // coefPrices7d = []
  dateUnixs30d = []
  coefPrices30d = []
  dateUnixs60d = []
  coefPrices60d = []
  dateUnixs90d = []
  coefPrices90d = []
  // coefPrices = []
  // coefVolumes = []
  // coefMarketCaps = []
  // coefVolatilitys = []

  const dateFromMetric = new FormatDate(fromMetric).getDateBegin()
  const dateToMetric = new FormatDate(toMetric).getDateBegin()
  const tokenATokenBData = new Hash(tokenAId + '/' + tokenBId)

  const histories = new Analitics().getWorkSheet('history')
  const overflowLists = new Analitics().getWorkSheet('overflowList')
  const historiesOldData =
    histories.arrayOfObject.filter((rowObject) => {
      return rowObject.tokenATokenBKey !== tokenATokenBData.md5
    }) || []

  const historiesPair =
    histories.arrayOfObject.filter((rowObject) => {
      return rowObject.tokenATokenBKey === tokenATokenBData.md5
    }) || []

  dateToMetric0dUnix = historiesPair.reduce((max, rowObject) => {
    if (max < rowObject.dateUnix) {
      max = rowObject.dateUnix
    }
    return max
  }, 0)

  // dateFromMetric3dUnix = new FormatDate(
  //   dateToMetric0dUnix * 1000
  // ).getPreviousDate(3).unix
  // dateFromMetric7dUnix = new FormatDate(
  //   dateToMetric0dUnix * 1000
  // ).getPreviousDate(7).unix
  dateFromMetric30dUnix = new FormatDate(
    dateToMetric0dUnix * 1000
  ).getPreviousDate(30).unix
  dateFromMetric60dUnix = new FormatDate(
    dateToMetric0dUnix * 1000
  ).getPreviousDate(60).unix
  dateFromMetric90dUnix = new FormatDate(
    dateToMetric0dUnix * 1000
  ).getPreviousDate(90).unix

  const historiesPairNew = historiesPair.reduce((object, rowObject) => {
    if (!object[rowObject.dateKey]) {
      object[rowObject.dateKey] = rowObject
    }

    // //* расчет волантильности
    // object[rowObject.dateKey].tokenAVolatility =
    //   rowObject.tokenAVolume / rowObject.tokenAMarketCap
    // object[rowObject.dateKey].tokenBVolatility =
    //   rowObject.tokenBVolume / rowObject.tokenBMarketCap
    // object[rowObject.dateKey].coefVolatility =
    //   object[rowObject.dateKey].tokenAVolatility /
    //   object[rowObject.dateKey].tokenBVolatility
    //* ограничение по входным параметрам
    if (
      rowObject.dateUnix >= dateFromMetric.unix &&
      rowObject.dateUnix <= dateToMetric.unix
    ) {
      dateUnixs.push(rowObject.dateUnix)
      coefPrices.push(object[rowObject.dateKey].coefPrice)
      // coefVolumes.push(object[rowObject.dateKey].coefVolume)
      // coefMarketCaps.push(object[rowObject.dateKey].coefPriceMarketCap)
      // coefVolatilitys.push(object[rowObject.dateKey].coefVolatility)
    }
    // //* за три последний дня
    // if (
    //   rowObject.dateUnix >= dateFromMetric3dUnix &&
    //   rowObject.dateUnix <= dateToMetric0dUnix
    // ) {
    //   dateUnixs3d.push(rowObject.dateUnix)
    //   coefPrices3d.push(object[rowObject.dateKey].coefPrice)
    // }
    // //* за 7 дней
    // if (
    //   rowObject.dateUnix >= dateFromMetric7dUnix &&
    //   rowObject.dateUnix <= dateToMetric0dUnix
    // ) {
    //   dateUnixs7d.push(rowObject.dateUnix)
    //   coefPrices7d.push(object[rowObject.dateKey].coefPrice)
    // }
    //* за 30 дней
    if (
      rowObject.dateUnix >= dateFromMetric30dUnix &&
      rowObject.dateUnix <= dateToMetric0dUnix
    ) {
      dateUnixs30d.push(rowObject.dateUnix)
      coefPrices30d.push(object[rowObject.dateKey].coefPrice)
    }
    //* за 60 дней
    if (
      rowObject.dateUnix >= dateFromMetric60dUnix &&
      rowObject.dateUnix <= dateToMetric0dUnix
    ) {
      dateUnixs60d.push(rowObject.dateUnix)
      coefPrices60d.push(object[rowObject.dateKey].coefPrice)
    }
    //* за 90 дней
    if (
      rowObject.dateUnix >= dateFromMetric90dUnix &&
      rowObject.dateUnix <= dateToMetric0dUnix
    ) {
      dateUnixs90d.push(rowObject.dateUnix)
      coefPrices90d.push(object[rowObject.dateKey].coefPrice)
    }
    return object
  }, {})

  //* расчет коэфициента цены
  let positiveArraydiffCoefPricestoLr,
    // positiveArraydiffCoefPricestoLr3d,
    // positiveArraydiffCoefPricestoLr7d,
    positiveArraydiffCoefPricestoLr30d,
    positiveArraydiffCoefPricestoLr60d,
    positiveArraydiffCoefPricestoLr90d
  positiveArraydiffCoefPricestoLr = []
  // positiveArraydiffCoefPricestoLr3d = []
  // positiveArraydiffCoefPricestoLr7d = []
  positiveArraydiffCoefPricestoLr30d = []
  positiveArraydiffCoefPricestoLr60d = []
  positiveArraydiffCoefPricestoLr90d = []
  let negativeArraydiffCoefPricestoLr,
    // negativeArraydiffCoefPricestoLr3d,
    // negativeArraydiffCoefPricestoLr7d,
    negativeArraydiffCoefPricestoLr30d,
    negativeArraydiffCoefPricestoLr60d,
    negativeArraydiffCoefPricestoLr90d
  negativeArraydiffCoefPricestoLr = []
  // negativeArraydiffCoefPricestoLr3d = []
  // negativeArraydiffCoefPricestoLr7d = []
  negativeArraydiffCoefPricestoLr30d = []
  negativeArraydiffCoefPricestoLr60d = []
  negativeArraydiffCoefPricestoLr90d = []

  let lrCoefPrices,
    // lrCoefPrices3d,
    // lrCoefPrices7d,
    lrCoefPrices30d,
    lrCoefPrices60d,
    lrCoefPrices90d

  lrCoefPrices = findLineByLeastSquares(dateUnixs, coefPrices)
  // lrCoefPrices3d = findLineByLeastSquares(dateUnixs3d, coefPrices3d)
  // lrCoefPrices7d = findLineByLeastSquares(dateUnixs7d, coefPrices7d)
  lrCoefPrices30d = findLineByLeastSquares(dateUnixs30d, coefPrices30d)
  lrCoefPrices60d = findLineByLeastSquares(dateUnixs60d, coefPrices60d)
  lrCoefPrices90d = findLineByLeastSquares(dateUnixs90d, coefPrices90d)

  let coefPriceAthArray, coefPriceAtlArray

  coefPriceAthArray = []
  coefPriceAtlArray = []

  lrCoefPrices.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey
    historiesPairNew[dateKey].lrCoefPrice = value
    //* расчет отклонения от средней регресионной
    historiesPairNew[dateKey].diffCoefPricestoLr =
      historiesPairNew[dateKey].coefPrice - value
    if (historiesPairNew[dateKey].diffCoefPricestoLr > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr.push(
        historiesPairNew[dateKey].diffCoefPricestoLr
      )
      coefPriceAthArray.push({
        dateKey: dateKey,
        diffCoefPricestoLr: historiesPairNew[dateKey].diffCoefPricestoLr,
        coefPrice: historiesPairNew[dateKey].coefPrice,
      })
    } else if (historiesPairNew[dateKey].diffCoefPricestoLr < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr.push(
        historiesPairNew[dateKey].diffCoefPricestoLr * -1
      )
      coefPriceAtlArray.push({
        dateKey: dateKey,
        diffCoefPricestoLr: historiesPairNew[dateKey].diffCoefPricestoLr * -1,
        coefPrice: historiesPairNew[dateKey].coefPrice,
      })
    }
  })

  //* Максимум и минимум коэффициенты
  let coefPriceAth
  coefPriceAth = { dateKey: void 0, diffCoefPricestoLr: 0 }
  coefPriceAthArray.forEach((object) => {
    if (object.diffCoefPricestoLr > coefPriceAth.diffCoefPricestoLr) {
      coefPriceAth = object
    }
  })

  let coefPriceAtl
  coefPriceAtl = { dateKey: void 0, diffCoefPricestoLr: 0 }
  coefPriceAtlArray.forEach((object) => {
    if (object.diffCoefPricestoLr > coefPriceAtl.diffCoefPricestoLr) {
      coefPriceAtl = object
    }
  })

  // lrCoefPrices3d.forEach(([dateUnix, value]) => {
  //   const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
  //     .dateKey
  //   historiesPairNew[dateKey].lrCoefPrice3d = value
  //   // arraylrCoefPrices.push(value)
  //   //* расчет отклонения от средней регресионной
  //   historiesPairNew[dateKey].diffCoefPricestoLr3d =
  //     historiesPairNew[dateKey].coefPrice - value
  //   if (historiesPairNew[dateKey].diffCoefPricestoLr3d > 0) {
  //     //* положительное отклонение
  //     positiveArraydiffCoefPricestoLr3d.push(
  //       historiesPairNew[dateKey].diffCoefPricestoLr3d
  //     )
  //   } else if (historiesPairNew[dateKey].diffCoefPricestoLr3d < 0) {
  //     //* отрицательное отклонение
  //     negativeArraydiffCoefPricestoLr3d.push(
  //       historiesPairNew[dateKey].diffCoefPricestoLr3d * -1
  //     )
  //   }
  // })

  // lrCoefPrices7d.forEach(([dateUnix, value]) => {
  //   const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
  //     .dateKey
  //   historiesPairNew[dateKey].lrCoefPrice7d = value
  //   // arraylrCoefPrices.push(value)
  //   //* расчет отклонения от средней регресионной
  //   historiesPairNew[dateKey].diffCoefPricestoLr7d =
  //     historiesPairNew[dateKey].coefPrice - value
  //   if (historiesPairNew[dateKey].diffCoefPricestoLr7d > 0) {
  //     //* положительное отклонение
  //     positiveArraydiffCoefPricestoLr7d.push(
  //       historiesPairNew[dateKey].diffCoefPricestoLr7d
  //     )
  //   } else if (historiesPairNew[dateKey].diffCoefPricestoLr7d < 0) {
  //     //* отрицательное отклонение
  //     negativeArraydiffCoefPricestoLr7d.push(
  //       historiesPairNew[dateKey].diffCoefPricestoLr7d * -1
  //     )
  //   }
  // })

  lrCoefPrices30d.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey
    historiesPairNew[dateKey].lrCoefPrice30d = value
    // arraylrCoefPrices.push(value)
    //* расчет отклонения от средней регресионной
    historiesPairNew[dateKey].diffCoefPricestoLr30d =
      historiesPairNew[dateKey].coefPrice - value
    if (historiesPairNew[dateKey].diffCoefPricestoLr30d > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr30d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr30d
      )
    } else if (historiesPairNew[dateKey].diffCoefPricestoLr30d < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr30d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr30d * -1
      )
    }
  })

  lrCoefPrices60d.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey
    historiesPairNew[dateKey].lrCoefPrice60d = value
    // arraylrCoefPrices.push(value)
    //* расчет отклонения от средней регресионной
    historiesPairNew[dateKey].diffCoefPricestoLr60d =
      historiesPairNew[dateKey].coefPrice - value
    if (historiesPairNew[dateKey].diffCoefPricestoLr60d > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr60d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr60d
      )
    } else if (historiesPairNew[dateKey].diffCoefPricestoLr60d < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr60d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr60d * -1
      )
    }
  })

  lrCoefPrices90d.forEach(([dateUnix, value]) => {
    const dateKey = new FormatDate(new Date(dateUnix * 1000)).getDateBegin()
      .dateKey
    historiesPairNew[dateKey].lrCoefPrice90d = value
    // arraylrCoefPrices.push(value)
    //* расчет отклонения от средней регресионной
    historiesPairNew[dateKey].diffCoefPricestoLr90d =
      historiesPairNew[dateKey].coefPrice - value
    if (historiesPairNew[dateKey].diffCoefPricestoLr90d > 0) {
      //* положительное отклонение
      positiveArraydiffCoefPricestoLr90d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr90d
      )
    } else if (historiesPairNew[dateKey].diffCoefPricestoLr90d < 0) {
      //* отрицательное отклонение
      negativeArraydiffCoefPricestoLr90d.push(
        historiesPairNew[dateKey].diffCoefPricestoLr90d * -1
      )
    }
  })

  let stdevPositiveArraydiffCoefPricestoLr,
    // stdevPositiveArraydiffCoefPricestoLr3d,
    // stdevPositiveArraydiffCoefPricestoLr7d,
    stdevPositiveArraydiffCoefPricestoLr30d,
    stdevPositiveArraydiffCoefPricestoLr60d,
    stdevPositiveArraydiffCoefPricestoLr90d

  //* стандратное отклонение
  stdevPositiveArraydiffCoefPricestoLr = getStandardDeviation(
    positiveArraydiffCoefPricestoLr
  )
  // stdevPositiveArraydiffCoefPricestoLr3d = getStandardDeviation(
  //   positiveArraydiffCoefPricestoLr3d
  // )
  // stdevPositiveArraydiffCoefPricestoLr7d = getStandardDeviation(
  //   positiveArraydiffCoefPricestoLr7d
  // )
  stdevPositiveArraydiffCoefPricestoLr30d = getStandardDeviation(
    positiveArraydiffCoefPricestoLr30d
  )
  stdevPositiveArraydiffCoefPricestoLr60d = getStandardDeviation(
    positiveArraydiffCoefPricestoLr60d
  )
  stdevPositiveArraydiffCoefPricestoLr90d = getStandardDeviation(
    positiveArraydiffCoefPricestoLr90d
  )

  let stdevNegativeArraydiffCoefPricestoLr,
    // stdevNegativeArraydiffCoefPricestoLr3d,
    // stdevNegativeArraydiffCoefPricestoLr7d,
    stdevNegativeArraydiffCoefPricestoLr30d,
    stdevNegativeArraydiffCoefPricestoLr60d,
    stdevNegativeArraydiffCoefPricestoLr90d

  stdevNegativeArraydiffCoefPricestoLr = getStandardDeviation(
    negativeArraydiffCoefPricestoLr
  )
  // stdevNegativeArraydiffCoefPricestoLr3d = getStandardDeviation(
  //   negativeArraydiffCoefPricestoLr3d
  // )
  // stdevNegativeArraydiffCoefPricestoLr7d = getStandardDeviation(
  //   negativeArraydiffCoefPricestoLr7d
  // )
  stdevNegativeArraydiffCoefPricestoLr30d = getStandardDeviation(
    negativeArraydiffCoefPricestoLr30d
  )
  stdevNegativeArraydiffCoefPricestoLr60d = getStandardDeviation(
    negativeArraydiffCoefPricestoLr60d
  )
  stdevNegativeArraydiffCoefPricestoLr90d = getStandardDeviation(
    negativeArraydiffCoefPricestoLr90d
  )

  //* вариативность
  let varPositiveArraydiffCoefPricestoLr,
    // varPositiveArraydiffCoefPricestoLr3d,
    // varPositiveArraydiffCoefPricestoLr7d,
    varPositiveArraydiffCoefPricestoLr30d,
    varPositiveArraydiffCoefPricestoLr60d,
    varPositiveArraydiffCoefPricestoLr90d

  varPositiveArraydiffCoefPricestoLr = calculateVariance(
    positiveArraydiffCoefPricestoLr
  )

  let varNegativeArraydiffCoefPricestoLr,
    // varNegativeArraydiffCoefPricestoLr3d,
    // varNegativeArraydiffCoefPricestoLr7d,
    varNegativeArraydiffCoefPricestoLr30d,
    varNegativeArraydiffCoefPricestoLr60d,
    varNegativeArraydiffCoefPricestoLr90d

  varNegativeArraydiffCoefPricestoLr = calculateVariance(
    negativeArraydiffCoefPricestoLr
  )

  // varNegativeArraydiffCoefPricestoLr3d = calculateVariance(
  //   negativeArraydiffCoefPricestoLr3d
  // )
  // varNegativeArraydiffCoefPricestoLr7d = calculateVariance(
  //   negativeArraydiffCoefPricestoLr7d
  // )
  varNegativeArraydiffCoefPricestoLr30d = calculateVariance(
    negativeArraydiffCoefPricestoLr30d
  )
  varNegativeArraydiffCoefPricestoLr60d = calculateVariance(
    negativeArraydiffCoefPricestoLr60d
  )
  varNegativeArraydiffCoefPricestoLr90d = calculateVariance(
    negativeArraydiffCoefPricestoLr90d
  )

  //* среднее
  let avgPositiveArraydiffCoefPricestoLr,
    // avgPositiveArraydiffCoefPricestoLr3d,
    // avgPositiveArraydiffCoefPricestoLr7d,
    avgPositiveArraydiffCoefPricestoLr30d,
    avgPositiveArraydiffCoefPricestoLr60d,
    avgPositiveArraydiffCoefPricestoLr90d

  avgPositiveArraydiffCoefPricestoLr = calculateAvg(
    positiveArraydiffCoefPricestoLr
  )
  // avgPositiveArraydiffCoefPricestoLr3d = calculateAvg(
  //   positiveArraydiffCoefPricestoLr3d
  // )
  // avgPositiveArraydiffCoefPricestoLr7d = calculateAvg(
  //   positiveArraydiffCoefPricestoLr7d
  // )
  avgPositiveArraydiffCoefPricestoLr30d = calculateAvg(
    positiveArraydiffCoefPricestoLr30d
  )
  avgPositiveArraydiffCoefPricestoLr60d = calculateAvg(
    positiveArraydiffCoefPricestoLr60d
  )
  avgPositiveArraydiffCoefPricestoLr90d = calculateAvg(
    positiveArraydiffCoefPricestoLr90d
  )

  let avgNegativeArraydiffCoefPricestoLr,
    // avgNegativeArraydiffCoefPricestoLr3d,
    // avgNegativeArraydiffCoefPricestoLr7d,
    avgNegativeArraydiffCoefPricestoLr30d,
    avgNegativeArraydiffCoefPricestoLr60d,
    avgNegativeArraydiffCoefPricestoLr90d

  avgNegativeArraydiffCoefPricestoLr = calculateAvg(
    negativeArraydiffCoefPricestoLr
  )
  // avgNegativeArraydiffCoefPricestoLr3d = calculateAvg(
  //   positiveArraydiffCoefPricestoLr3d
  // )
  // avgNegativeArraydiffCoefPricestoLr7d = calculateAvg(
  //   positiveArraydiffCoefPricestoLr7d
  // )
  avgNegativeArraydiffCoefPricestoLr30d = calculateAvg(
    negativeArraydiffCoefPricestoLr30d
  )
  avgNegativeArraydiffCoefPricestoLr60d = calculateAvg(
    negativeArraydiffCoefPricestoLr60d
  )
  avgNegativeArraydiffCoefPricestoLr90d = calculateAvg(
    negativeArraydiffCoefPricestoLr90d
  )

  //* коэффициент вариативности
  let coefVarPositiveArraydiffCoefPricestoLr,
    // coefVarPositiveArraydiffCoefPricestoLr3d,
    // coefVarPositiveArraydiffCoefPricestoLr7d,
    coefVarPositiveArraydiffCoefPricestoLr30d,
    coefVarPositiveArraydiffCoefPricestoLr60d,
    coefVarPositiveArraydiffCoefPricestoLr90d

  coefVarPositiveArraydiffCoefPricestoLr =
    stdevPositiveArraydiffCoefPricestoLr / avgPositiveArraydiffCoefPricestoLr

  // coefVarPositiveArraydiffCoefPricestoLr3d =
  //   stdevPositiveArraydiffCoefPricestoLr3d /
  //   avgPositiveArraydiffCoefPricestoLr3d

  // coefVarPositiveArraydiffCoefPricestoLr7d =
  //   stdevPositiveArraydiffCoefPricestoLr7d /
  //   avgPositiveArraydiffCoefPricestoLr7d

  coefVarPositiveArraydiffCoefPricestoLr30d =
    stdevPositiveArraydiffCoefPricestoLr30d /
    avgPositiveArraydiffCoefPricestoLr30d

  coefVarPositiveArraydiffCoefPricestoLr60d =
    stdevPositiveArraydiffCoefPricestoLr60d /
    avgPositiveArraydiffCoefPricestoLr60d

  coefVarPositiveArraydiffCoefPricestoLr90d =
    stdevPositiveArraydiffCoefPricestoLr90d /
    avgPositiveArraydiffCoefPricestoLr90d

  let coefVarNegativeArraydiffCoefPricestoLr,
    // coefVarNegativeArraydiffCoefPricestoLr3d,
    // coefVarNegativeArraydiffCoefPricestoLr7d,
    coefVarNegativeArraydiffCoefPricestoLr30d,
    coefVarNegativeArraydiffCoefPricestoLr60d,
    coefVarNegativeArraydiffCoefPricestoLr90d

  coefVarNegativeArraydiffCoefPricestoLr =
    stdevNegativeArraydiffCoefPricestoLr / avgNegativeArraydiffCoefPricestoLr

  // coefVarNegativeArraydiffCoefPricestoLr3d =
  //   stdevNegativeArraydiffCoefPricestoLr3d /
  //   avgNegativeArraydiffCoefPricestoLr3d

  // coefVarNegativeArraydiffCoefPricestoLr7d =
  //   stdevNegativeArraydiffCoefPricestoLr7d /
  //   avgNegativeArraydiffCoefPricestoLr7d

  coefVarNegativeArraydiffCoefPricestoLr30d =
    stdevNegativeArraydiffCoefPricestoLr30d /
    avgNegativeArraydiffCoefPricestoLr30d

  coefVarNegativeArraydiffCoefPricestoLr60d =
    stdevNegativeArraydiffCoefPricestoLr60d /
    avgNegativeArraydiffCoefPricestoLr60d

  coefVarNegativeArraydiffCoefPricestoLr90d =
    stdevNegativeArraydiffCoefPricestoLr90d /
    avgNegativeArraydiffCoefPricestoLr90d

  // //* расчет коэффициента объема
  // const lrCoefVolumes = findLineByLeastSquares(times, coefVolumes)
  // lrCoefVolumes.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   historiesPairNew[dateKey].lrCoefVolume = value
  // })
  // //* расчет коэффициента капитализации
  // const lrcoefPriceMarketCaps = findLineByLeastSquares(times, coefMarketCaps)
  // lrcoefPriceMarketCaps.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   historiesPairNew[dateKey].lrCoefPriceMarketCap = value
  // })
  // //* расчет коэффициента волантильности
  // const lrCoefVolatilitys = findLineByLeastSquares(times, coefVolatilitys)
  // lrCoefVolatilitys.forEach(([time, value]) => {
  //   const dateKey = new Hash(time).md5
  //   historiesPairNew[dateKey].lrCoefVolatility = value
  // })

  const arrayOfObjecthistoriesPairNew = Object.values(historiesPairNew)
  arrayOfObjecthistoriesPairNew.forEach((rowObject) => {
    if (
      rowObject.lrCoefPrice &&
      rowObject.dateUnix >= dateFromMetric.unix &&
      rowObject.dateUnix <= dateToMetric.unix
    ) {
      rowObject.lrCoefPriceHigh =
        rowObject.lrCoefPrice +
        stdevPositiveArraydiffCoefPricestoLr *
          (coefVarPositiveArraydiffCoefPricestoLr + 1)
      // rowObject.stdevPositiveArraydiffCoefPricestoLr = stdevPositiveArraydiffCoefPricestoLr
      // rowObject.varPositiveArraydiffCoefPricestoLr = varPositiveArraydiffCoefPricestoLr
      // rowObject.avgPositiveArraydiffCoefPricestoLr = avgPositiveArraydiffCoefPricestoLr
      // rowObject.coefVarPositiveArraydiffCoefPricestoLr = coefVarPositiveArraydiffCoefPricestoLr
      rowObject.lrCoefPriceLow =
        rowObject.lrCoefPrice -
        stdevNegativeArraydiffCoefPricestoLr *
          (coefVarNegativeArraydiffCoefPricestoLr + 1)
      rowObject.coefPriceAth = coefPriceAth.coefPrice
      rowObject.coefPriceAtl = coefPriceAtl.coefPrice
      // rowObject.stdevNegativeArraydiffCoefPricestoLr = stdevNegativeArraydiffCoefPricestoLr
      // rowObject.varNegativeArraydiffCoefPricestoLr = varNegativeArraydiffCoefPricestoLr
      // rowObject.avgNegativeArraydiffCoefPricestoLr = avgNegativeArraydiffCoefPricestoLr
      // rowObject.coefVarNegativeArraydiffCoefPricestoLr = coefVarNegativeArraydiffCoefPricestoLr
    } else {
      rowObject.lrCoefPrice = void 0
      rowObject.lrCoefPriceHigh = void 0
      rowObject.lrCoefPriceLow = void 0
      rowObject.coefPriceAth = void 0
      rowObject.coefPriceAtl = void 0
    }

    // if (rowObject.lrCoefPrice3d) {
    //   rowObject.lrCoefPriceHigh3d =
    //     rowObject.lrCoefPrice3d +
    //     stdevPositiveArraydiffCoefPricestoLr3d *
    //       (coefVarPositiveArraydiffCoefPricestoLr3d + 1)

    //   rowObject.lrCoefPriceLow3d =
    //     rowObject.lrCoefPrice3d -
    //     stdevNegativeArraydiffCoefPricestoLr3d *
    //       (coefVarNegativeArraydiffCoefPricestoLr3d + 1)
    // }

    // if (rowObject.lrCoefPrice7d) {
    //   rowObject.lrCoefPriceHigh7d =
    //     rowObject.lrCoefPrice7d +
    //     stdevPositiveArraydiffCoefPricestoLr7d *
    //       (coefVarPositiveArraydiffCoefPricestoLr7d + 1)

    //   rowObject.lrCoefPriceLow7d =
    //     rowObject.lrCoefPrice7d -
    //     stdevNegativeArraydiffCoefPricestoLr7d *
    //       (coefVarNegativeArraydiffCoefPricestoLr7d + 1)
    // }

    if (rowObject.lrCoefPrice30d) {
      rowObject.lrCoefPriceHigh30d =
        rowObject.lrCoefPrice30d +
        stdevPositiveArraydiffCoefPricestoLr30d *
          (coefVarPositiveArraydiffCoefPricestoLr30d + 1)

      rowObject.lrCoefPriceLow30d =
        rowObject.lrCoefPrice30d -
        stdevNegativeArraydiffCoefPricestoLr30d *
          (coefVarNegativeArraydiffCoefPricestoLr30d + 1)
    }

    if (rowObject.lrCoefPrice60d) {
      rowObject.lrCoefPriceHigh60d =
        rowObject.lrCoefPrice60d +
        stdevPositiveArraydiffCoefPricestoLr60d *
          (coefVarPositiveArraydiffCoefPricestoLr60d + 1)

      rowObject.lrCoefPriceLow60d =
        rowObject.lrCoefPrice60d -
        stdevNegativeArraydiffCoefPricestoLr60d *
          (coefVarNegativeArraydiffCoefPricestoLr60d + 1)
    }

    if (rowObject.lrCoefPrice90d) {
      rowObject.lrCoefPriceHigh90d =
        rowObject.lrCoefPrice90d +
        stdevPositiveArraydiffCoefPricestoLr90d *
          (coefVarPositiveArraydiffCoefPricestoLr90d + 1)

      rowObject.lrCoefPriceLow90d =
        rowObject.lrCoefPrice90d -
        stdevNegativeArraydiffCoefPricestoLr90d *
          (coefVarNegativeArraydiffCoefPricestoLr90d + 1)
    }
  })
  const historiesArrayOfObject = Object.values(arrayOfObjecthistoriesPairNew)
  histories.truncateInsertRows([...historiesOldData, ...historiesArrayOfObject])
  //*############################
  //* Расчет и сохранение каналов
  //*############################
  const historiesArrayOfObjectfilter = historiesArrayOfObject.filter(
    (rowObject) => {
      return (
        rowObject.dateUnix >= dateFromMetric.unix &&
        rowObject.dateUnix <= dateToMetric.unix
      )
    }
  )
  const dateUnixArray = historiesArrayOfObjectfilter.map((m) => m.dateUnix)
  const lrCoefPriceArray = historiesArrayOfObjectfilter.map(
    (m) => m.lrCoefPrice
  )
  const LrCoefPriceHighArray = historiesArrayOfObjectfilter.map(
    (m) => m.lrCoefPriceLow
  )
  const lrCoefPriceLowArray = historiesArrayOfObjectfilter.map(
    (m) => m.lrCoefPriceHigh
  )

  const lrCoefPriceFormula = linearRegression(dateUnixArray, lrCoefPriceArray)
  const LrCoefPriceHighFormula = linearRegression(
    dateUnixArray,
    LrCoefPriceHighArray
  )
  const lrCoefPriceLowFormula = linearRegression(
    dateUnixArray,
    lrCoefPriceLowArray
  )
  const dateFromData = new FormatDate(fromMetric)
  const dateToData = new FormatDate(toMetric)

  {
  }
  const rowKey = new Hash(
    tokenAId + tokenBId + dateFromData.value + dateToData.value
  ).md5
  const overflowListRowObject = {
    rowKey: rowKey,
    tokenAId: tokenAId,
    tokenBId: tokenBId,
    dateFrom: dateFromData.getFormatDate('yyyy-MM-dd'),
    dateTo: dateToData.getFormatDate('yyyy-MM-dd'),
    lrCoefPriceSlope: lrCoefPriceFormula.slope,
    lrCoefPriceIntercept: lrCoefPriceFormula.intercept,
    lrCoefPriceR2: lrCoefPriceFormula.r2,
    lrCoefPriceHighSlope: LrCoefPriceHighFormula.slope,
    lrCoefPriceHighIntercept: LrCoefPriceHighFormula.intercept,
    lrCoefPriceHighR2: lrCoefPriceFormula.r2,
    lrCoefPriceLowSlope: lrCoefPriceLowFormula.slope,
    lrCoefPriceLowIntercept: lrCoefPriceLowFormula.intercept,
    lrCoefPriceLowR2: lrCoefPriceFormula.r2,
    isValideChannel: false,
  }
  if (!overflowLists.object[rowKey]) {
    overflowLists.object[rowKey] = overflowListRowObject
  }

  overflowLists.truncateInsertRows(Object.values(overflowLists.object))
  lock.releaseLock()
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
 * @param {array} x
 * @param {array} y
 * @returns slope, intercept, r2
 */
function linearRegression(x, y) {
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
