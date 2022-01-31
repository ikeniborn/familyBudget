var ss = SpreadsheetApp.openById('1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg')
exchangeratesapiLib.instance('3276674210a7471ea773005f04b4a669')
cryptorankLib.instance(
  'f512dfeb3966b63ac221826ab8501a53d96662a203ad786860d5cc268b85'
)
cryptocompareLib.instance(
  '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125'
)

coinMarketCapLib.instance('133c18b7-555c-4e57-ad7b-4d2bf6160c20')

function updatePrice() {
  const ws = ss.getSheetByName('Price')
  const values = ws.getDataRange().getValues()
  const header = values.shift()
  const data = values.slice(0)
  const listId = Object.fromEntries(
    header.map((list, index) => {
      const listData = data
        .map((row) => {
          if (['symbol', 'cryptocompareId'].indexOf(list) !== -1) {
            row = row[index].toUpperCase()
          } else {
            row = row[index]
          }
          return row
        })
        .filter((f) => f)
        .join(',')
      list = [list, listData]
      return list
    })
  )
  const cryptorank = getCryptorankData(listId.symbol)
  const coinMarketCap = getCoinMarketCapData(listId.coinmarketcapId)
  const coinGecko = getCoinGeckoData(listId.coingeckoId)
  const cryptocompare = getCryptocompareData(listId.cryptocompareId)
  const priceList = data.reduce(
    (coins, row) => {
      const coin = {}
      header.forEach((head, indexHeader) => {
        if (['source'].indexOf(head) !== -1) {
          coin[head] = ''
        } else {
          coin[head] = row[indexHeader]
        }
      })
      const coinData =
        coinGecko[coin.coingeckoId] ||
        coinMarketCap[coin.coinmarketcapId] ||
        cryptorank[coin.symbol.toUpperCase()] ||
        cryptocompare[coin.cryptocompareId.toUpperCase()] ||
        coin
      const fullData = Object.entries(coin).map((column, index) => {
        if (index > 4) {
          if (coinData[column[0]]) {
            column[1] = coinData[column[0]]
          }
        }
        return column[1]
      })
      coins.push(fullData)
      return coins
    },
    [header]
  )
  ws.clear()
  ws.getRange(1, 1, priceList.length, priceList[0].length).setValues(priceList)
}

function getCoinMarketCapData(listId) {
  return Object.values(
    coinMarketCapLib.cryptocurrencyQuotesLatest(listId)
  ).reduce((data, coin) => {
    if (!data[coin.slug]) {
      data[coin.slug] = {}
    }
    if (coin.is_active === 1) {
      data[coin.slug] = {
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
        percentChange1h: coin.quote.USD.percent_change_1h,
        percentChange24h: coin.quote.USD.percent_change_24h,
        percentChange7d: coin.quote.USD.percent_change_7d,
        percentChange30d: coin.quote.USD.percent_change_30d,
        percentChange3m: '',
        percentChange6m: '',
        marketCapDominance: coin.quote.USD.market_cap_dominance,
        fullyDilutedMarketCap: coin.quote.USD.fully_diluted_market_cap,
        source: 'CoinMarketCap',
        dateUpdate: new Date(),
      }
    }
    return data
  }, {})
}

function getCryptorankData(listId) {
  try {
    return cryptorankLib.currenciesLatest(listId).reduce((data, coin) => {
      if (!data[coin.symbol]) {
        data[coin.symbol] = {}
      }
      data[coin.symbol] = {
        id: coin.id,
        slug: coin.slug,
        symbol: coin.symbol,
        name: coin.name,
        dateAdded: '',
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
        volumeChange24h: '',
        marketCap: coin.values.USD.marketCap,
        percentChange1h: '',
        percentChange24h: coin.values.USD.percentChange24h,
        percentChange7d: coin.values.USD.percentChange7d,
        percentChange30d: coin.values.USD.percentChange30d,
        percentChange3m: coin.values.USD.percentChange3m,
        percentChange6m: coin.values.USD.percentChange6m,
        volume24hBase: coin.volume24hBase,
        marketCapDominance: '',
        fullyDilutedMarketCap: '',
        source: 'Cryptorank',
        dateUpdate: new Date(),
      }
      return data
    }, {})
  } catch (error) {
    console.log('getCryptorankData: ', error)
  }
}

function getCoinGeckoData(listId) {
  try {
    return coinGeckoLib.coinsMarkets(listId).reduce((data, coin) => {
      if (!data[coin.id]) {
        data[coin.id] = {}
      }
      data[coin.id] = {
        id: coin.id,
        slug: '',
        symbol: coin.symbol,
        name: coin.name,
        dateAdded: '',
        rank: coin.rank,
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
        percentChange1h: '',
        percentChange24h: '',
        percentChange7d: '',
        percentChange30d: '',
        percentChange3m: '',
        percentChange6m: '',
        volume24hBase: '',
        marketCapDominance: '',
        fullyDilutedMarketCap: '',
        source: 'CoinGecko',
        dateUpdate: new Date(),
      }
      return data
    }, {})
  } catch (error) {
    console.log('getCoinGeckoData: ', error)
  }
}

function getCryptocompareData(listId) {
  try {
    return Object.entries(cryptocompareLib.priceMulti(listId)).reduce(
      (data, coin) => {
        if (!data[coin[0]]) {
          data[coin[0]] = {}
        }
        data[coin[0]] = {
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
          percentChange1h: '',
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
