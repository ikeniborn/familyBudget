exchangeratesapiLib.instance('3276674210a7471ea773005f04b4a669')
cryptorankLib.instance(
  'f512dfeb3966b63ac221826ab8501a53d96662a203ad786860d5cc268b85'
)
cryptocompareLib.instance(
  '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125'
)
coinMarketCapLib.instance('133c18b7-555c-4e57-ad7b-4d2bf6160c20')

const gas = gasLib.instance([
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

function updatePrice() {
  gasLib.getWorkSheet('portfolio', 'price')
  const permanentHeader = ['name', 'symbol', 'id', 'source']
  const ws = gasLib.workSheet
  const header = gasLib.workSheetHeaderValues
  const data = gasLib.workSheetDataValues
  const deleteEmptyRows = gasLib.workSheetDeleteEmptyRows
  const listId = Object.fromEntries(
    Object.entries(
      data
        .map((m) => (m = [m[2], m[3]]))
        .filter((f) => f[0])
        .reduce((list, values) => {
          if (!list[values[1]]) {
            list[values[1]] = []
          }
          list[values[1]].push(values[0])
          return list
        }, {})
    ).map((m) => (m = [m[0], m[1].join(',')]))
  )
  let coinDataMap = []

  Object.entries(getCryptorankData_(listId.cryptorank.toUpperCase())).forEach(
    (map) => {
      coinDataMap.push(map)
    }
  )

  Object.entries(getCoinGeckoData_(listId.coingecko)).forEach((map) => {
    coinDataMap.push(map)
  })

  Object.entries(getCoinMarketCapData_(listId.coinmarketcap)).forEach((map) => {
    coinDataMap.push(map)
  })

  Object.entries(
    getCryptocompareData_(listId.cryptocompare.toUpperCase())
  ).forEach((map) => {
    coinDataMap.push(map)
  })

  coinDataMap = Object.fromEntries(coinDataMap)
  const priceList = data.reduce(
    (coins, row) => {
      const coin = {}
      const coinSymbol = row[1].toUpperCase()
      header.forEach((head, indexHeader) => {
        if (permanentHeader.indexOf(head) !== -1) {
          coin[head] = row[indexHeader]
        } else {
          if (coinDataMap[coinSymbol]) {
            coin[head] = coinDataMap[coinSymbol][head]
          } else {
            coin[head] = row[indexHeader]
          }
        }
      })
      // const fullData = Object.entries(coin).map((column) => {
      //   let columnName = column[0]
      //   let columnValue = column[1]
      //   if (permanentHeader.indexOf(columnName) === -1) {
      //     if (coinMarketCapMap.has(columnName)) {
      //       columnValue = coinMarketCapMap.get(columnName)
      //     } else if (cryptorankMap.has(columnName)) {
      //       columnValue = cryptorankMap.get(columnName)
      //     }
      //     if (cryptocompareMap.has(columnName)) {
      //       columnValue = cryptocompareMap.get(columnName)
      //     } else {
      //       if (columnName === 'price') {
      //         columnValue = coin[columnName]
      //       }
      //     }
      //   }
      //   return columnValue
      // })
      // coins.push(fullData)
      coins.push(Object.values(coin))
      return coins
    },
    [header]
  )
  // console.log(priceList)
  ws.clear()
  ws.getRange(1, 1, priceList.length, priceList[0].length).setValues(priceList)
  deleteEmptyRows()
}

function getCoinMarketCapData_(listId) {
  return Object.values(
    coinMarketCapLib.cryptocurrencyQuotesLatest(listId)
  ).reduce((data, coin) => {
    const coinKey = coin.symbol.toUpperCase()
    if (!data[coinKey]) {
      data[coinKey] = {}
    }
    if (coin.is_active === 1) {
      data[coinKey] = {
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
    return data
  }, {})
}

function getCryptorankData_(listId) {
  try {
    return cryptorankLib.currenciesLatest(listId).reduce((data, coin) => {
      const coinKey = coin.symbol.toUpperCase()
      if (!data[coinKey]) {
        data[coinKey] = {}
      }
      data[coinKey] = {
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
      return data
    }, {})
  } catch (error) {
    console.log('getCryptorankData: ', error)
  }
}

function getCoinGeckoData_(listId) {
  try {
    return coinGeckoLib.coinsMarkets(listId).reduce((data, coin) => {
      const coinKey = coin.symbol.toUpperCase()
      if (!data[coinKey]) {
        data[coinKey] = {}
      }
      data[coinKey] = {
        id: coin.id,
        slug: '',
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
      return data
    }, {})
  } catch (error) {
    console.log('getCoinGeckoData: ', error)
  }
}

function getCryptocompareData_(listId) {
  try {
    return Object.entries(cryptocompareLib.priceMulti(listId)).reduce(
      (data, coin) => {
        const coinKey = coin[0].toUpperCase()
        if (!data[coinKey]) {
          data[coinKey] = {}
        }
        data[coinKey] = {
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
        return data
      },
      {}
    )
  } catch (error) {
    console.log('getCryptocompareData: ', error)
  }
}
