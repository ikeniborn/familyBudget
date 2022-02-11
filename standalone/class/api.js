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
        coin[1].CoinName,
        coin[1].Symbol,
        coin[0],
      ])
    })
    const currency = [
      ['USA dollar', 'USD'],
      ['Russian rubble', 'RUB'],
      ['Euro', 'EUR'],
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
