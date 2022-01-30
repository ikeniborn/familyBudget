var ss = SpreadsheetApp.openById('1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg')
exchangeratesapiLib.instance('3276674210a7471ea773005f04b4a669')
cryptorankLib.instance(
  'f512dfeb3966b63ac221826ab8501a53d96662a203ad786860d5cc268b85'
)
cryptocompareLib.instance(
  '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125'
)

coinMarketCapLib.instance('133c18b7-555c-4e57-ad7b-4d2bf6160c20')

function updateCoinMarketCap() {
  const coins = ss
    .getSheetByName('Coins')
    .getDataRange()
    .getValues()
    .filter((f) => f[5])
    .map((m) => (m = m[5]))
    .join(',')
  const prices = Object.values(
    coinMarketCapLib.cryptocurrencyQuotesLatest(coins)
  ).map((coin) => {
    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      slug: coin.slug,
      date_added: coin.date_added,
      max_supply: coin.max_supply,
      circulating_supply: coin.circulating_supply,
      total_supply: coin.total_supply,
      is_active: coin.is_active,
      cmc_rank: coin.cmc_rank,
      is_fiat: coin.is_fiat,
      price: coin.quote.USD.price,
      volume_24h: coin.quote.USD.volume_24h,
      volume_change_24h: coin.quote.USD.volume_change_24h,
      percent_change_1h: coin.quote.USD.percent_change_1h,
      percent_change_24h: coin.quote.USD.percent_change_24h,
      percent_change_7d: coin.quote.USD.percent_change_7d,
      percent_change_30d: coin.quote.USD.percent_change_30d,
      market_cap: coin.quote.USD.market_cap,
      market_cap_dominance: coin.quote.USD.market_cap_dominance,
      fully_diluted_market_cap: coin.quote.USD.fully_diluted_market_cap,
    }
  })
  const data = []
  data.push(Object.keys(prices[0]))
  prices.forEach((coin) => {
    data.push(Object.values(coin))
  })
  const ws = ss.getSheetByName('CoinMarketCap')
  ws.clear()
  ws.getRange(1, 1, data.length, data[0].length).setValues(data)
}

function updateCryptocompareCoinList() {
  const coins = Object.entries(cryptocompareLib.infoCoinList()).map((coin) => {
    return {
      fsym: coin[0],
      Id: coin[1].Id,
      Name: coin[1].Name,
      Symbol: coin[1].Symbol,
      SmartContractAddress: coin[1].SmartContractAddress,
      CoinName: coin[1].CoinName,
      FullName: coin[1].FullName,
      ProofType: coin[1].ProofType,
      IsTrading: coin[1].IsTrading,
      TotalCoinsMined: coin[1].TotalCoinsMined,
      CirculatingSupply: coin[1].CirculatingSupply,
      PlatformType: coin[1].PlatformType,
      FCA: coin[1].Taxonomy.FCA,
      FINMA: coin[1].Taxonomy.FINMA,
      Industry: coin[1].Taxonomy.Industry,
      CollateralizedAsset: coin[1].Taxonomy.CollateralizedAsset,
      CollateralizedAssetType: coin[1].Taxonomy.CollateralizedAssetType,
      CollateralType: coin[1].Taxonomy.CollateralType,
      IsTrading: coin[1].IsTrading,
      AssetLaunchDate: coin[1].AssetLaunchDate,
      AssetWhitepaperUrl: coin[1].AssetWhitepaperUrl,
      AssetWebsiteUrl: coin[1].AssetWebsiteUrl,
    }
  })
  const data = []
  data.push(Object.keys(coins[0]))
  coins.forEach((coin) => {
    data.push(Object.values(coin))
  })
  const ws = ss.getSheetByName('CoinList')
  ws.clear()
  ws.getRange(1, 1, data.length, data[0].length).setValues(data)
}

function updateCryptocompare() {
  try {
    const coins = ss
      .getSheetByName('Coins')
      .getDataRange()
      .getValues()
      .filter((f) => f[1])
      .map((m) => (m = m[1]))
      .join(',')
    const prices = Object.entries(cryptocompareLib.priceMulti(coins)).map(
      (coin) => {
        return {
          symbol: coin[0],
          current_price: coin[1].USD,
        }
      }
    )
    const data = []
    data.push(Object.keys(prices[0]))
    prices.forEach((coin) => {
      data.push(Object.values(coin))
    })
    const ws = ss.getSheetByName('Price')
    ws.clear()
    ws.getRange(1, 1, data.length, data[0].length).setValues(data)
  } catch (error) {
    console.log('updateCryptocompare: ', error)
  }
}

function updateCoinGecko() {
  try {
    const coins = ss
      .getSheetByName('Coins')
      .getDataRange()
      .getValues()
      .filter((f) => f[2])
      .map((m) => (m = m[2]))
      .join(',')
    const prices = coinGeckoLib.coinsMarkets('usd', coins).map((coin) => {
      return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        current_price: coin.current_price,
        market_cap: coin.market_cap,
        market_cap_rank: coin.market_cap_rank,
        total_volume: coin.total_volume,
        high_24h: coin.high_24h,
        low_24h: coin.low_24h,
        price_change_24h: coin.price_change_24h,
        price_change_percentage_24h: coin.price_change_percentage_24h,
        market_cap_change_24h: coin.market_cap_change_24h,
        market_cap_change_percentage_24h: coin.market_cap_change_percentage_24h,
        circulating_supply: coin.circulating_supply,
        total_supply: coin.total_supply,
        max_supply: coin.max_supply,
        ath: coin.ath,
        ath_change_percentage: coin.ath_change_percentage,
        ath_date: coin.ath_date,
        atl: coin.atl,
        atl_change_percentage: coin.atl_change_percentage,
        atl_date: coin.atl_date,
      }
    })
    const data = []
    data.push(Object.keys(prices[0]))
    prices.forEach((coin) => {
      data.push(Object.values(coin))
    })
    const ws = ss.getSheetByName('CoinGecko')
    ws.clear()
    ws.getRange(1, 1, data.length, data[0].length).setValues(data)
  } catch (error) {
    console.log('updateCoinGecko: ', error)
  }
}

function updateCryptorank() {
  try {
    const coins = ss
      .getSheetByName('Coins')
      .getDataRange()
      .getValues()
      .filter((f) => f[3])
      .map((m) => (m = m[3]))
      .join(',')
    const prices = cryptorankLib.currenciesLatest(coins).map((coin) => {
      return {
        id: coin.id,
        slug: coin.slug,
        symbol: coin.symbol,
        name: coin.name,
        type: coin.type,
        category: coin.category,
        rank: coin.rank,
        price: coin.values.USD.price,
        volume24h: coin.values.USD.volume24h,
        high24h: coin.values.USD.high24h,
        low24h: coin.values.USD.low24h,
        marketCap: coin.values.USD.marketCap,
        percentChange24h: coin.values.USD.percentChange24h,
        percentChange7d: coin.values.USD.percentChange7d,
        percentChange30d: coin.values.USD.percentChange30d,
        percentChange3m: coin.values.USD.percentChange3m,
        percentChange6m: coin.values.USD.percentChange6m,
        volume24hBase: coin.volume24hBase,
        circulatingSupply: coin.circulatingSupply,
        totalSupply: coin.totalSupply,
        maxSupply: coin.maxSupply,
        totalSupply: coin.totalSupply,
        lastUpdated: coin.lastUpdated,
      }
    })
    const data = []
    data.push(Object.keys(prices[0]))
    prices.forEach((coin) => {
      data.push(Object.values(coin))
    })
    const ws = ss.getSheetByName('Cryptorank')
    ws.clear()
    ws.getRange(1, 1, data.length, data[0].length).setValues(data)
  } catch (error) {
    console.log('updateCryptorank: ', error)
  }
}

function updateFiat() {
  try {
    const currencys = ss
      .getSheetByName('Coins')
      .getDataRange()
      .getValues()
      .filter((f) => f[4])
      .map((m) => (m = m[4]))
      .join(',')
    const prices = exchangeratesapiLib.getLatest('usd', currencys)
    const data = [['Name', 'Rates']]
    Object.entries(prices).forEach((currency) => {
      data.push(currency)
    })
    const ws = ss.getSheetByName('Fiat')
    ws.clear()
    ws.getRange(1, 1, data.length, data[0].length).setValues(data)
  } catch (error) {
    console.log('updateFiat: ', error)
  }
}
