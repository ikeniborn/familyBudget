function updateCoinPrice() {
  const head = new Header()
  const portfolioPrice = (() => {
    gasLib.getWorkSheet('portfolio', 'price')
    return {
      workSheet: gasLib.workSheet,
      workSheetHeaderValues: gasLib.workSheetHeaderValues,
      workSheetDataValues: gasLib.workSheetDataValues,
      workSheetDeleteEmptyRows: gasLib.workSheetDeleteEmptyRows,
    }
  })()
  const portfolioCoinList = (() => {
    gasLib.getWorkSheet('portfolio', 'coinlist')
    return {
      workSheet: gasLib.workSheet,
      workSheetHeaderValues: gasLib.workSheetHeaderValues,
      workSheetDataValues: gasLib.workSheetDataValues,
      workSheetDeleteEmptyRows: gasLib.workSheetDeleteEmptyRows,
    }
  })()
  const portfolioHistoricalPrice = (() => {
    gasLib.getWorkSheet('portfolio', 'historicalprice')
    return {
      workSheet: gasLib.workSheet,
      workSheetDataValues: gasLib.workSheetDataValues,
      workSheetDeleteEmptyRows: gasLib.workSheetDeleteEmptyRows,
    }
  })()
  const permanentHeader = ['name', 'symbol', 'source']
  const coinList = portfolioCoinList.workSheetDataValues.reduce((list, row) => {
    const rowKey = row[head.coinList.rowKey.idx]
    const id = row[head.coinList.id.idx]
    if (!list[rowKey]) {
      list[rowKey] = id
    }
    return list
  }, {})
  const listId = Object.fromEntries(
    Object.entries(
      portfolioPrice.workSheetDataValues
        .map((m) => (m = [m[1], m[2]]))
        .filter((f) => f[0])
        .reduce((list, values) => {
          if (!list[values[1]] && values[1]) {
            list[values[1]] = []
          }
          if (values[1]) {
            let hashKey = utilsLib.getHashMd5(values[1] + values[0])
            const coinId = coinList[hashKey]
            list[values[1]].push(coinId)
          }
          return list
        }, {})
    ).map((m) => (m = [m[0], m[1].join(',')]))
  )

  const coinsData = {}
  if (listId.cryptorank) {
    getCryptoRankPrice_(listId.cryptorank, coinsData)
  }
  if (listId.coingecko) {
    getCoinGeckoPrice_(listId.coingecko, coinsData)
  }
  if (listId.coinmarketcap) {
    getCoinMarketCapPrice_(listId.coinmarketcap, coinsData)
  }
  if (listId.cryptocompare) {
    getCryptoComparePrice_(listId.cryptocompare, coinsData)
  }

  const yyyymmdd = utilsLib.getYYYYMMDDFromDate(new Date())
  const date = utilsLib.getDateFromYYYYMMDD(yyyymmdd)
  const yyyymmddKey = utilsLib.getHashMd5(date)
  const historicalPrice = portfolioHistoricalPrice.workSheetDataValues.filter(
    (row) => {
      return row[head.hisoricalPrice.dateKey.idx] !== yyyymmddKey
    }
  )
  const historicalPriceHeader = [
    'Row Key',
    'Date key',
    'Symbol key',
    'Pair key',
    'Date',
    'Symbol',
    'Pair',
    'Price',
  ]
  historicalPrice.splice(0, 0, historicalPriceHeader)

  const priceList = portfolioPrice.workSheetDataValues.reduce(
    (coins, row) => {
      const coin = {}
      const coinSymbol = row[1].toUpperCase()
      portfolioPrice.workSheetHeaderValues.forEach((head, indexHeader) => {
        if (permanentHeader.indexOf(head) !== -1) {
          coin[head] = row[indexHeader]
        } else {
          if (coinsData[coinSymbol]) {
            coin[head] = coinsData[coinSymbol][head]
          } else {
            coin[head] = row[indexHeader]
          }
        }
      })
      const coinData = Object.values(coin)
      const symbol = coinData[head.price.symbol.idx].toUpperCase()
      const pair = 'USD'
      const price = coinData[head.price.price.idx]
      const rowKey = utilsLib.getHashMd5(date + symbol + pair)
      const symbolKey = utilsLib.getHashMd5(symbol)
      const pairKey = utilsLib.getHashMd5(pair)
      const historicalCoinData = [
        rowKey,
        yyyymmddKey,
        symbolKey,
        pairKey,
        date,
        symbol,
        pair,
        price,
      ]
      historicalPrice.push(historicalCoinData)
      coins.push(coinData)
      return coins
    },
    [portfolioPrice.workSheetHeaderValues]
  )

  //* снятие фильтра
  const customFilterHistoricalPrice = portfolioHistoricalPrice.workSheet.getFilter()
  if (customFilterHistoricalPrice) {
    customFilterHistoricalPrice.remove()
  }
  portfolioHistoricalPrice.workSheet
    .clear()
    .getRange(1, 1, historicalPrice.length, historicalPrice[0].length)
    .setValues(historicalPrice)
  portfolioHistoricalPrice.workSheetDeleteEmptyRows()

  //* снятие фильтра
  const customFilterPrice = portfolioPrice.workSheet.getFilter()
  if (customFilterPrice) {
    customFilterPrice.remove()
  }
  portfolioPrice.workSheet
    .clear()
    .getRange(1, 1, priceList.length, priceList[0].length)
    .setValues(priceList)
  portfolioPrice.workSheetDeleteEmptyRows()
}

function updateCoinList() {
  const portfolioCoinList = (() => {
    gasLib.getWorkSheet('portfolio', 'coinlist', { getValues: true })
    return {
      workSheet: gasLib.workSheet,
      workSheetDeleteEmptyRows: gasLib.workSheetDeleteEmptyRows,
    }
  })()
  const coinlist = [['hashKey', 'source', 'name', 'symbol', 'id']]
  getCoinGeckoCoinList_(coinlist)
  getCryptoRankCoinList_(coinlist)
  getCoinMarketCapCoinList_(coinlist)
  getCryptoCompareCoinList_(coinlist)
  //* снятие фильтра
  const customFilter = portfolioCoinList.workSheet.getFilter()
  if (customFilter) {
    customFilter.remove()
  }
  portfolioCoinList.workSheet
    .clear()
    .getRange(1, 1, coinlist.length, coinlist[0].length)
    .setValues(coinlist)
  portfolioCoinList.workSheetDeleteEmptyRows()
}

function updateDataSet() {
  const head = new Header()
  const portfolioAccount = (() => {
    gasLib.getWorkSheet('portfolio', 'account')
    return {
      workSheetDataValues: gasLib.workSheetDataValues,
    }
  })()
  const portfolioPrice = (() => {
    gasLib.getWorkSheet('portfolio', 'price')
    return {
      workSheetDataValues: gasLib.workSheetDataValues,
    }
  })()
  const portfolioDataset = (() => {
    gasLib.getWorkSheet('portfolio', 'dataset')
    return {
      workSheet: gasLib.workSheet,
      workSheetDeleteEmptyRows: gasLib.workSheetDeleteEmptyRows,
    }
  })()
  const portfolioHistoricalPrice = (() => {
    gasLib.getWorkSheet('portfolio', 'historicalprice')
    return {
      workSheetDataValues: gasLib.workSheetDataValues,
    }
  })()

  const coinPriceList = portfolioPrice.workSheetDataValues.reduce(
    (list, row) => {
      const hashKey = utilsLib.getHashMd5(row[head.price.symbol.idx])
      if (!list[hashKey]) {
        list[hashKey] = row[head.price.price.idx]
      }
      return list
    },
    {}
  )
  const historicalCoinPriceList = portfolioHistoricalPrice.workSheetDataValues.reduce(
    (list, row) => {
      const yyyymmdd = utilsLib.getYYYYMMDDFromDate(
        row[head.hisoricalPrice.date.idx]
      )
      const symbol = row[head.hisoricalPrice.symbol.idx]
      const hashKey = utilsLib.getHashMd5(yyyymmdd + symbol)
      if (!list[hashKey]) {
        list[hashKey] = row[head.hisoricalPrice.price.idx]
      }
      return list
    },
    {}
  )
  const dataSet = []
  portfolioAccount.workSheetDataValues.forEach((row, index) => {
    const rowData = {
      date: row[head.account.date.idx],
      time: row[head.account.time.idx],
      operation: row[head.account.operation.idx],
      account: row[head.account.account.idx],
      platform: row[head.account.platform.idx],
      service: row[head.account.service.idx],
      sender: row[head.account.sender.idx],
      recipient: row[head.account.recipient.idx],
      coin: row[head.account.coin.idx].toUpperCase(),
      coinQty: row[head.account.coinQty.idx],
      currency: row[head.account.currency.idx].toUpperCase(),
      currencyQty: row[head.account.currencyQty.idx],
      currencyPerCoin: row[head.account.currencyPerCoin.idx],
      feeCurrency: row[head.account.feeCurrency.idx].toUpperCase(),
      feeQty: row[head.account.feeQty.idx],
      comment: row[head.account.comment.idx],
    }
    let rowSetOne
    let rowSetTwo
    if (rowData.date) {
      const yyyymmdd = utilsLib.getYYYYMMDDFromDate(rowData.date)
      if (rowData.operation === 'Transfer') {
        rowSetOne = {
          date: rowData.date,
          account: rowData.account,
          platform: rowData.platform,
          service: rowData.service,
          contractor: rowData.sender,
          coin: rowData.coin,
          pair: '',
          price: '',
          quantity: rowData.coinQty * -1,
          historicalCost:
            historicalCoinPriceList[
              utilsLib.getHashMd5(yyyymmdd + rowData.coin)
            ] *
            rowData.coinQty *
            -1,
          currentCost:
            coinPriceList[utilsLib.getHashMd5(rowData.coin)] *
            rowData.coinQty *
            -1,
          comment: rowData.comment,
        }
        rowSetTwo = {
          date: rowData.date,
          account: rowData.account,
          platform: rowData.platform,
          service: rowData.service,
          contractor: rowData.recipient,
          coin: rowData.coin,
          pair: '',
          price: '',
          quantity: rowData.coinQty,
          historicalCost:
            historicalCoinPriceList[
              utilsLib.getHashMd5(yyyymmdd + rowData.coin)
            ] * rowData.coinQty,
          currentCost:
            coinPriceList[utilsLib.getHashMd5(rowData.coin)] * rowData.coinQty,
          comment: rowData.comment,
        }
      } else if (rowData.operation === 'Buy') {
        const coinQty = rowData.coinQty
          ? rowData.coinQty
          : rowData.currencyQty / rowData.currencyPerCoin
        rowSetOne = {
          date: rowData.date,
          account: rowData.account,
          platform: rowData.platform,
          service: rowData.service,
          contractor: rowData.sender,
          coin: rowData.currency,
          pair: rowData.coin,
          price: coinQty / rowData.currencyQty,
          quantity: rowData.currencyQty * -1,
          historicalCost:
            historicalCoinPriceList[
              utilsLib.getHashMd5(yyyymmdd + rowData.currency)
            ] *
            rowData.currencyQty *
            -1,
          currentCost:
            coinPriceList[utilsLib.getHashMd5(rowData.currency)] *
            rowData.currencyQty *
            -1,
          comment: rowData.comment,
        }
        rowSetTwo = {
          date: rowData.date,
          account: rowData.account,
          platform: rowData.platform,
          service: rowData.service,
          contractor: rowData.recipient,
          coin: rowData.coin,
          pair: rowData.currency,
          price: rowData.currencyPerCoin
            ? rowData.currencyPerCoin
            : rowData.currencyQty / coinQty,
          quantity: coinQty,
          historicalCost:
            historicalCoinPriceList[
              utilsLib.getHashMd5(yyyymmdd + rowData.coin)
            ] * coinQty,
          currentCost:
            coinPriceList[utilsLib.getHashMd5(rowData.coin)] * coinQty,
          comment: rowData.comment,
        }
      } else if (rowData.operation === 'Sell') {
        const currencyQty = rowData.currencyQty
          ? rowData.currencyQty
          : rowData.coinQty * rowData.currencyPerCoin
        rowSetOne = {
          date: rowData.date,
          account: rowData.account,
          platform: rowData.platform,
          service: rowData.service,
          contractor: rowData.sender,
          coin: rowData.coin,
          pair: rowData.currency,
          price: rowData.currencyPerCoin
            ? rowData.currencyPerCoin
            : currencyQty / rowData.coinQty,
          quantity: rowData.coinQty * -1,
          historicalCost:
            historicalCoinPriceList[
              utilsLib.getHashMd5(yyyymmdd + rowData.coin)
            ] *
            rowData.coinQty *
            -1,
          currentCost:
            coinPriceList[utilsLib.getHashMd5(rowData.coin)] *
            rowData.coinQty *
            -1,
          comment: rowData.comment,
        }
        rowSetTwo = {
          date: rowData.date,
          account: rowData.account,
          platform: rowData.platform,
          service: rowData.service,
          contractor: rowData.recipient,
          coin: rowData.currency,
          pair: rowData.coin,
          price: rowData.coinQty / currencyQty,
          quantity: currencyQty,
          historicalCost:
            historicalCoinPriceList[
              utilsLib.getHashMd5(yyyymmdd + rowData.currency)
            ] * currencyQty,
          currentCost:
            coinPriceList[utilsLib.getHashMd5(rowData.currency)] * currencyQty,
          comment: rowData.comment,
        }
      }
      if (index === 0) {
        dataSet.push(Object.keys(rowSetOne))
      }
      dataSet.push(Object.values(rowSetOne))
      dataSet.push(Object.values(rowSetTwo))
    }
  })
  //* снятие фильтра
  const customFilter = portfolioDataset.workSheet.getFilter()
  if (customFilter) {
    customFilter.remove()
  }
  portfolioDataset.workSheet
    .clear()
    .getRange(1, 1, dataSet.length, dataSet[0].length)
    .setValues(dataSet)
  portfolioDataset.workSheetDeleteEmptyRows()
}
