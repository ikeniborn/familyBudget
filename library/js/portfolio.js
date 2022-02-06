exchangeRatesApiLib.instance('3276674210a7471ea773005f04b4a669')
cryptoRankLib.instance(
  'f512dfeb3966b63ac221826ab8501a53d96662a203ad786860d5cc268b85'
)
cryptoCompareLib.instance(
  '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125'
)
coinMarketCapLib.instance('133c18b7-555c-4e57-ad7b-4d2bf6160c20')

gasLib.instance([
  {
    spreadSheetName: 'portfolio',
    sheetId: '1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1HdeIaXO5WjYOvyv02CgQi3IDpb95YYDt5zYAPLF2IJA',
    scriptId: '1HVxNmr_vVQNl6DS1g1aBscXDTJSmGdHRkxBAzAmqaasvs7y7hnTZvh7y',
    area: 'dev',
  },
])

function updateCoinPrice() {
  const portfolioPrice = (() => {
    gasLib.getWorkSheet('portfolio', 'price')
    return {
      workSheet: gasLib.workSheet,
      workSheetHeaderValues: gasLib.workSheetHeaderValues,
      workSheetDataValues: gasLib.workSheetDataValues,
      deleteEmptyRows: gasLib.workSheetDeleteEmptyRows,
    }
  })()
  const portfolioCoinList = (() => {
    gasLib.getWorkSheet('portfolio', 'coinlist')
    return {
      workSheet: gasLib.workSheet,
      workSheetHeaderValues: gasLib.workSheetHeaderValues,
      workSheetDataValues: gasLib.workSheetDataValues,
      deleteEmptyRows: gasLib.workSheetDeleteEmptyRows,
    }
  })()
  const permanentHeader = ['name', 'symbol', 'source']
  const coinList = portfolioCoinList.workSheetDataValues.reduce((list, row) => {
    if (!list[row[0]]) {
      list[row[0]] = row[4]
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

  const coinData = {}
  if (listId.cryptorank) {
    getCryptoRankPrice_(listId.cryptorank, coinData)
  }
  if (listId.coingecko) {
    getCoinGeckoPrice_(listId.coingecko, coinData)
  }
  if (listId.coinmarketcap) {
    getCoinMarketCapPrice_(listId.coinmarketcap, coinData)
  }
  if (listId.cryptocompare) {
    getCryptoComparePrice_(listId.cryptocompare, coinData)
  }

  const priceList = portfolioPrice.workSheetDataValues.reduce(
    (coins, row) => {
      const coin = {}
      const coinSymbol = row[1].toUpperCase()
      portfolioPrice.workSheetHeaderValues.forEach((head, indexHeader) => {
        if (permanentHeader.indexOf(head) !== -1) {
          coin[head] = row[indexHeader]
        } else {
          if (coinData[coinSymbol]) {
            coin[head] = coinData[coinSymbol][head]
          } else {
            coin[head] = row[indexHeader]
          }
        }
      })
      coins.push(Object.values(coin))
      return coins
    },
    [portfolioPrice.workSheetHeaderValues]
  )
  portfolioPrice.workSheet.clear()
  portfolioPrice.workSheet
    .getRange(1, 1, priceList.length, priceList[0].length)
    .setValues(priceList)
  portfolioPrice.deleteEmptyRows()
}

function getCoinMarketCapPrice_(listId, coinData) {
  try {
    Object.values(coinMarketCapLib.quotesLatest(listId)).forEach((coin) => {
      const coinKey = coin.symbol.toUpperCase()
      if (!coinData[coinKey]) {
        coinData[coinKey] = {}
      }
      if (coin.is_active === 1) {
        coinData[coinKey] = {
          id: coin.id,
          slug: coin.slug,
          symbol: coin.symbol,
          name: coin.name,
          dateAdded: coin.date_added,
          rank: coin.cmc_rank,
          maxSupply: coin.max_supply,
          circulatingSupply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          price: coin.quote.USD.price,
          high24h: '',
          low24h: '',
          volume24h: coin.quote.USD.volume_24h,
          volumeChange24h: coin.quote.USD.volume_change_24h,
          marketCap: coin.quote.USD.market_cap,
          percentChange24h: coin.quote.USD.percent_change_24h,
          percentChange7d: coin.quote.USD.percent_change_7d,
          percentChange30d: coin.quote.USD.percent_change_30d,
          marketCapDominance: coin.quote.USD.market_cap_dominance,
          fullyDilutedMarketCap: coin.quote.USD.fully_diluted_market_cap,
          lastUpdated: coin.last_updated,
          source: 'CoinMarketCap',
        }
      }
    })
    return coinData
  } catch (error) {
    console.log('getCoinMarketCapPrice_: ', error)
  }
}

function getCryptoRankPrice_(listId, coinData) {
  try {
    cryptoRankLib.currenciesLatest(listId).forEach((coin) => {
      const coinKey = coin.symbol.toUpperCase()
      if (!coinData[coinKey]) {
        coinData[coinKey] = {}
      }
      coinData[coinKey] = {
        id: coin.id,
        slug: coin.slug,
        symbol: coin.symbol,
        name: coin.name,
        rank: coin.rank,
        type: coin.type,
        category: coin.category,
        maxSupply: coin.maxSupply,
        circulatingSupply: coin.circulatingSupply,
        totalSupply: coin.totalSupply,
        price: coin.values.USD.price,
        high24h: coin.values.USD.high24h,
        low24h: coin.values.USD.low24h,
        volume24h: coin.values.USD.volume24h,
        marketCap: coin.values.USD.marketCap,
        percentChange24h: coin.values.USD.percentChange24h,
        percentChange7d: coin.values.USD.percentChange7d,
        percentChange30d: coin.values.USD.percentChange30d,
        percentChange3m: coin.values.USD.percentChange3m,
        percentChange6m: coin.values.USD.percentChange6m,
        volume24hBase: coin.volume24hBase,
        marketCapDominance: '',
        fullyDilutedMarketCap: '',
        lastUpdated: coin.lastUpdated,
        source: 'Cryptorank',
      }
    })
    return coinData
  } catch (error) {
    console.log('getCryptoRankPrice_: ', error)
  }
}

function getCoinGeckoPrice_(listId, coinData) {
  try {
    coinGeckoLib.coinsMarkets(listId).forEach((coin) => {
      const coinKey = coin.symbol.toUpperCase()
      if (!coinData[coinKey]) {
        coinData[coinKey] = {}
      }
      coinData[coinKey] = {
        id: coin.id,
        slug: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        rank: coin.market_cap_rank,
        type: coin.type,
        category: '',
        maxSupply: coin.max_supply,
        circulatingSupply: coin.circulating_supply,
        totalSupply: coin.total_supply,
        price: coin.current_price,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        volume24h: '',
        volumeChange24h: '',
        marketCap: coin.market_cap,
        percentChange24h: coin.price_change_percentage_24h_in_currency,
        percentChange7d: coin.price_change_percentage_7d_in_currency,
        percentChange30d: coin.price_change_percentage_30d_in_currency,
        fullyDilutedMarketCap: coin.fully_diluted_valuation,
        dateUpdate: coin.last_updated,
        source: 'CoinGecko',
      }
    })
    return coinData
  } catch (error) {
    console.log('getCoinGeckoPrice_: ', error)
  }
}

function getCryptoComparePrice_(listId, coinData) {
  try {
    Object.entries(cryptoCompareLib.priceMulti(listId)).forEach((coin) => {
      const coinKey = coin[0].toUpperCase()
      if (!coinData[coinKey]) {
        coinData[coinKey] = {}
      }
      coinData[coinKey] = {
        id: '',
        slug: '',
        symbol: coin[0],
        name: '',
        dateAdded: '',
        rank: '',
        type: '',
        category: '',
        maxSupply: '',
        circulatingSupply: '',
        totalSupply: '',
        price: coin[1].USD,
        high24h: '',
        low24h: '',
        volume24h: '',
        volumeChange24h: '',
        marketCap: '',
        percentChange24h: '',
        percentChange7d: '',
        percentChange30d: '',
        percentChange3m: '',
        percentChange6m: '',
        volume24hBase: '',
        marketCapDominance: '',
        fullyDilutedMarketCap: '',
        source: 'Cryptocompare',
        dateUpdate: new Date(),
      }
    })
  } catch (error) {
    console.log('getCryptoComparePrice_: ', error)
  }
}

function updateCoinList() {
  const portfolioCoinList = (() => {
    gasLib.getWorkSheet('portfolio', 'coinlist')
    return {
      workSheet: gasLib.workSheet,
      workSheetHeaderValues: gasLib.workSheetHeaderValues,
      workSheetDataValues: gasLib.workSheetDataValues,
      deleteEmptyRows: gasLib.workSheetDeleteEmptyRows,
    }
  })()
  const ws = portfolioCoinList.workSheet
  const coinlist = [['hashKey', 'source', 'symbol', 'name', 'id']]
  getCoinGeckoCoinList_(coinlist)
  getCryptoRankCoinList_(coinlist)
  getCoinMarketCapCoinList_(coinlist)
  getCryptoCompareCoinList_(coinlist)
  ws.clear()
  ws.getRange(1, 1, coinlist.length, coinlist[0].length).setValues(coinlist)
  portfolioCoinList.workSheetDeleteEmptyRows()
}

function getCoinGeckoCoinList_(coinlist) {
  try {
    coinGeckoLib.coinsList().forEach((coin) => {
      let rowHash = utilsLib.getHashMd5('coingecko' + coin.symbol)
      coinlist.push([rowHash, 'coingecko', coin.name, coin.symbol, coin.id])
    })
    return coinlist
  } catch (error) {
    console.log('getCoinGeckoCoinList_: ', error)
  }
}

function getCryptoRankCoinList_(coinlist) {
  try {
    cryptoRankLib.currenciesList(15000).forEach((coin) => {
      let rowHash = utilsLib.getHashMd5('cryptorank' + coin.symbol)
      coinlist.push([rowHash, 'cryptorank', coin.name, coin.symbol, coin.id])
    })
    return coinlist
  } catch (error) {
    console.log('getCryptoRankCoinList_: ', error)
  }
}

function getCoinMarketCapCoinList_(coinlist) {
  try {
    coinMarketCapLib.mapList().forEach((coin) => {
      let rowHash = utilsLib.getHashMd5('coinmarketcap' + coin.symbol)
      coinlist.push([rowHash, 'coinmarketcap', coin.name, coin.symbol, coin.id])
    })
    return coinlist
  } catch (error) {
    console.log('getCoinMarketCapCoinList_: ', error)
  }
}

function getCryptoCompareCoinList_(coinlist) {
  try {
    Object.entries(cryptoCompareLib.infoCoinList()).forEach((coin) => {
      let rowHash = utilsLib.getHashMd5('cryptocompare' + coin[0])
      coinlist.push([
        rowHash,
        'cryptocompare',
        coin[1].Symbol,
        coin[1].CoinName,
        coin[0],
      ])
    })
    const currency = [
      ['USD', 'USA dollar'],
      ['RUB', 'Russian rubble'],
      ['EUR', 'Euro'],
    ]
    currency.forEach((coin) => {
      let rowHash = utilsLib.getHashMd5('cryptocompare' + coin[0])
      coinlist.push([rowHash, 'cryptocompare', coin[0], coin[1], coin[0]])
    })
    return coinlist
  } catch (error) {
    console.log('getCryptoCompareCoinList_: ', error)
  }
}

class Header {
  constructor() {}
  get dataSet() {
    return {
      date: { num: 1, idx: 0 },
      time: { num: 2, idx: 1 },
      operation: { num: 3, idx: 2 },
      operationType: { num: 4, idx: 3 },
      service: { num: 5, idx: 4 },
      writeOff: { num: 6, idx: 5 },
      reFill: { num: 7, idx: 6 },
      coin: { num: 8, idx: 7 },
      coinQty: { num: 9, idx: 8 },
      currency: { num: 10, idx: 9 },
      currencyQty: { num: 11, idx: 10 },
      currencyPerCoin: { num: 12, idx: 11 },
      coinPerCurrencyCalc: { num: 13, idx: 12 },
      currencyPerCoinCalc: { num: 14, idx: 13 },
      totalQty: { num: 15, idx: 14 },
      totalUsd: { num: 16, idx: 15 },
      feeCurrency: { num: 17, idx: 16 },
      feeQty: { num: 18, idx: 17 },
      feeUsd: { num: 19, idx: 18 },
      comment: { num: 20, idx: 19 },
    }
  }
}

function updateDataSet() {
  const head = new Header()
  const portfolioAccount = (() => {
    gasLib.getWorkSheet('portfolio', 'account')
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
  const dataSet = []
  portfolioAccount.workSheetDataValues.forEach((row, index) => {
    const rowData = {
      date: row[head.dataSet.date.idx],
      time: row[head.dataSet.time.idx],
      operation: row[head.dataSet.operation.idx],
      operationType: row[head.dataSet.operationType.idx],
      service: row[head.dataSet.service.idx],
      writeOff: row[head.dataSet.writeOff.idx],
      reFill: row[head.dataSet.reFill.idx],
      coin: row[head.dataSet.coin.idx],
      coinQty: row[head.dataSet.coinQty.idx],
      currency: row[head.dataSet.currency.idx],
      currencyQty: row[head.dataSet.currencyQty.idx],
      currencyPerCoin: row[head.dataSet.currencyPerCoin.idx],
      coinPerCurrencyCalc: row[head.dataSet.coinPerCurrencyCalc.idx],
      currencyPerCoinCalc: row[head.dataSet.currencyPerCoinCalc.idx],
      totalQty: row[head.dataSet.totalQty.idx],
      totalUsd: row[head.dataSet.totalUsd.idx],
      feeCurrency: row[head.dataSet.feeCurrency.idx],
      feeQty: row[head.dataSet.feeQty.idx],
      feeUsd: row[head.dataSet.feeUsd.idx],
      comment: row[head.dataSet.comment.idx],
    }
    let rowSetOne
    let rowSetTwo
    if (rowData.date) {
      if (rowData.operation === 'Transfer') {
        rowSetOne = {
          date: rowData.date,
          time: rowData.time,
          operation: rowData.operation,
          operationType: rowData.operationType,
          service: rowData.service,
          contractor: rowData.writeOff,
          contractorType: 'writeOff',
          coinName: rowData.coin,
          coinPair: rowData.coin,
          coinPrice: 1,
          value: rowData.totalQty,
          operationCoef: -1,
        }
        rowSetTwo = {
          date: rowData.date,
          time: rowData.time,
          operation: rowData.operation,
          operationType: rowData.operationType,
          service: rowData.service,
          contractor: rowData.reFill,
          contractorType: 'reFill',
          coinName: rowData.coin,
          coinPair: rowData.coin,
          coinPrice: 1,
          value: rowData.totalQty,
          operationCoef: 1,
        }
      } else if (rowData.operation === 'Buy') {
        rowSetOne = {
          date: rowData.date,
          time: rowData.time,
          operation: rowData.operation,
          operationType: rowData.operationType,
          service: rowData.service,
          contractor: rowData.writeOff,
          contractorType: 'writeOff',
          coinName: rowData.currency,
          coinPair: rowData.coin,
          coinPrice: rowData.coinPerCurrencyCalc,
          value: rowData.currencyQty,
          operationCoef: -1,
        }
        rowSetTwo = {
          date: rowData.date,
          time: rowData.time,
          operation: rowData.operation,
          operationType: rowData.operationType,
          service: rowData.service,
          contractor: rowData.reFill,
          contractorType: 'reFill',
          coinName: rowData.coin,
          coinPair: rowData.currency,
          coinPrice: rowData.currencyPerCoinCalc,
          value: rowData.totalQty,
          operationCoef: 1,
        }
      } else if (rowData.operation === 'Sell') {
        rowSetOne = {
          date: rowData.date,
          time: rowData.time,
          operation: rowData.operation,
          operationType: rowData.operationType,
          service: rowData.service,
          contractor: rowData.writeOff,
          contractorType: 'writeOff',
          coinName: rowData.coin,
          coinPair: rowData.currency,
          coinPrice: rowData.currencyPerCoinCalc,
          value: rowData.coinQty,
          operationCoef: -1,
        }
        rowSetTwo = {
          date: rowData.date,
          time: rowData.time,
          operation: rowData.operation,
          operationType: rowData.operationType,
          service: rowData.service,
          contractor: rowData.reFill,
          contractorType: 'reFill',
          coinName: rowData.currency,
          coinPair: rowData.coin,
          coinPrice: rowData.coinPerCurrencyCalc,
          value: rowData.totalQty,
          operationCoef: 1,
        }
      }
      if (index === 0) {
        dataSet.push(Object.keys(rowSetOne))
      }
      dataSet.push(Object.values(rowSetOne))
      dataSet.push(Object.values(rowSetTwo))
    }
  })
  portfolioDataset.workSheet
    .clear()
    .getRange(1, 1, dataSet.length, dataSet[0].length)
    .setValues(dataSet)
  portfolioDataset.workSheetDeleteEmptyRows()
}
