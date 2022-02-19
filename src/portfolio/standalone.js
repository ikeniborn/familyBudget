import * as cryptoRank from '../restApi/cryptoRank'
// import * as exchangeRatesApi from '../../../src/restApi/exchangeRatesApi'
import * as cryptoCompare from '../restApi/cryptoCompare'
import * as coinMarketCap from '../restApi/coinMarketCap'
import * as coinGecko from '../restApi/coinGecko'
import * as gas from '../gas'
import * as utils from '../utils'

// const exchangeRatesApiInstance = new exchangeRatesApi.Instance(
//   '3276674210a7471ea773005f04b4a669'
// )
const cryptoRankInstance = new cryptoRank.Instance(
  'f512dfeb3966b63ac221826ab8501a53d96662a203ad786860d5cc268b85'
)
const cryptoCompareInstance = new cryptoCompare.Instance(
  '48597114e40192c1699cd11f30fc9b1b7d4db9e25ae08ac85736631ffad5a125'
)
const coinMarketCapInstance = new coinMarketCap.Instance(
  '133c18b7-555c-4e57-ad7b-4d2bf6160c20'
)
const coinGeckoInstance = new coinGecko.Instance()

new gas.GasEnvironment([
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
  {
    spreadSheetName: 'coingecko',
    sheetId: '1wTTuxXt8n9q7C4NDXqQpI3wpKu1_5bGVmP9Xz0XGSyU',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'coingecko',
    sheetId: '1wTTuxXt8n9q7C4NDXqQpI3wpKu1_5bGVmP9Xz0XGSyU',
    scriptId: '1HVxNmr_vVQNl6DS1g1aBscXDTJSmGdHRkxBAzAmqaasvs7y7hnTZvh7y',
    area: 'dev',
  },
])

class Header {
  constructor() {
    /**
     * @param {object} obj list header with alias
     * @returns {{}} return same object with new params: idx, num, name
     */
    function updateProps(obj) {
      return Object.entries(obj).reduce((newcolumn, oldColumn, index) => {
        newcolumn[oldColumn[0]] = Object.entries(oldColumn[1]).reduce(
          (newParams, oldParams) => {
            if (oldParams[0]) {
              newParams[oldParams[0]] = oldParams[1]
            }
            newParams.num = index + 1
            newParams.idx = index
            newParams.name = oldColumn[0]
            return newParams
          },
          {}
        )
        return newcolumn
      }, {})
    }
    this.account = updateProps({
      date: { alias: 'Date' },
      time: { alias: 'Time' },
      operation: { alias: 'Operation' },
      account: { alias: 'Account' },
      platform: { alias: 'Platform' },
      service: { alias: 'Service' },
      sender: { alias: 'Sender' },
      recipient: { alias: 'Recipient' },
      coin: { alias: 'Coin' },
      coinQty: { alias: 'Coin, qty' },
      currency: { alias: 'Currency' },
      currencyQty: { alias: 'Currency, qty' },
      currencyPerCoin: { alias: 'Currency per coin' },
      feeCurrency: { alias: 'Fee currency' },
      feeQty: { alias: 'Fee, qty' },
      comment: { alias: 'Comment' },
    })
    this.price = updateProps({
      name: { alias: 'Name', permanent: true },
      symbol: { alias: 'Symbol', permanent: true },
      source: { alias: 'Source', permanent: true },
      price: { alias: 'Price' },
      high24h: { alias: 'High 24h' },
      low24h: { alias: 'Low 24h' },
      percentChange24h: { alias: 'Change 24h, %' },
      percentChange7d: { alias: 'Change 7d, %' },
      percentChange30d: { alias: 'Change 30d, %' },
      percentChange3m: { alias: 'Change 3m, %' },
      percentChange6m: { alias: 'Change 6m, %' },
      rank: { alias: 'Rank' },
      type: { alias: 'Type' },
      category: { alias: 'Category' },
      circulatingSupply: { alias: 'Circulating supply' },
      maxSupply: { alias: 'Max supply' },
      volume24h: { alias: 'Volume 24h' },
      marketCap: { alias: 'Market cap' },
      fullyDilutedMarketCap: { alias: 'Fully diluted market cap' },
      lastUpdated: { alias: 'Last updated' },
    })
    this.dataset = updateProps({
      date: { alias: 'Date' },
      account: { alias: 'Account' },
      platform: { alias: 'Platform' },
      service: { alias: 'Service' },
      contractor: { alias: 'Contractor' },
      coin: { alias: 'Coin' },
      pair: { alias: 'Pair' },
      price: { alias: 'Price' },
      quantity: { alias: 'Quantity' },
      historicalCost: { alias: 'Historical cost' },
      currentCost: { alias: 'Current cost' },
      comment: { alias: 'Comment' },
    })
    this.historicalPrice = updateProps({
      rowKey: { alias: 'Row key' },
      dateKey: { alias: 'Date key' },
      symbolKey: { alias: 'Symbol key' },
      pairKey: { alias: 'Pair key' },
      date: { alias: 'Date' },
      symbol: { alias: 'Symbol' },
      pair: { alias: 'Pair' },
      price: { alias: 'Price' },
    })
    this.coinList = updateProps({
      rowKey: { alias: 'Row key' },
      source: { alias: 'Source' },
      name: { alias: 'Name' },
      symbol: { alias: 'Symbol' },
      id: { alias: 'Id' },
    })
  }
  /**
   * Get head alias
   * @param {object} head Header object
   * @returns {array}
   */
  getHeaderAlias(head) {
    return Object.values(head).map((m) => m.alias)
  }
}

class Portfolio {
  constructor() {
    this.head = new Header()
  }

  updateCoinPrice() {
    const portfolioPrice = new gas.GasWorkSheet('portfolio', 'price')
    const portfolioCoinList = new gas.GasWorkSheet('portfolio', 'coinlist')
    const coinList = portfolioCoinList.dataValues.reduce((list, row) => {
      const rowKey = row[this.head.coinList.rowKey.idx]
      const id = row[this.head.coinList.id.idx]
      if (!list[rowKey]) {
        list[rowKey] = id
      }
      return list
    }, {})
    const listId = Object.fromEntries(
      Object.entries(
        portfolioPrice.dataValues
          .filter((f) => f[this.head.price.symbol.idx])
          .map(
            (m) =>
              (m = {
                symbol: m[this.head.price.symbol.idx],
                source: m[this.head.price.source.idx],
              })
          )
          .reduce((list, values) => {
            if (!list[values.source] && values.source) {
              list[values.source] = []
            }
            if (values.source) {
              let rowKey = new utils.Hash(values.source + values.symbol).md5
              list[values.source].push(coinList[rowKey])
            }
            return list
          }, {})
      ).map((m) => (m = [m[0], m[1].join(',')]))
    )
    const coinsData = {}
    if (listId.cryptorank) {
      new cryptoRank.Price(cryptoRankInstance)
        .getLastPrice(listId.cryptorank)
        .forEach((coin) => {
          const coinKey = coin.symbol.toUpperCase()
          if (!coinsData[coinKey]) {
            coinsData[coinKey] = {}
          }
          coinsData[coinKey] = {
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
            volume24: coin.volume24hBase,
            marketCapDominance: '',
            fullyDilutedMarketCap: '',
            lastUpdated: coin.lastUpdated,
          }
        })
    }
    if (listId.coingecko) {
      new coinGecko.Price(coinGeckoInstance)
        .getMarketsPrice(listId.coingecko)
        .forEach((coin) => {
          const coinKey = coin.symbol.toUpperCase()
          if (!coinsData[coinKey]) {
            coinsData[coinKey] = {}
          }
          coinsData[coinKey] = {
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
    }
    if (listId.coinmarketcap) {
      Object.values(
        new coinMarketCap.Price(coinMarketCapInstance).getLastPrice(
          listId.coinmarketcap
        )
      ).forEach((coin) => {
        const coinKey = coin.symbol.toUpperCase()
        if (!coinsData[coinKey]) {
          coinsData[coinKey] = {}
        }
        if (coin.is_active === 1) {
          coinsData[coinKey] = {
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
    }
    if (listId.cryptocompare) {
      Object.entries(
        new cryptoCompare.Price(cryptoCompareInstance).getMultiPrice(
          listId.cryptocompare
        )
      ).forEach((coin) => {
        const coinKey = coin[0].toUpperCase()
        if (!coinsData[coinKey]) {
          coinsData[coinKey] = {}
        }
        coinsData[coinKey] = {
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
          lastUpdated: new Date(),
        }
      })
    }

    const priceArray = portfolioPrice.dataValues.reduce(
      (coins, row) => {
        const coin = {}
        const coinSymbol = row[1].toUpperCase()
        Object.values(this.head.price).forEach((head) => {
          if (head.permanent) {
            coin[head.name] = row[head.idx]
          } else {
            if (coinsData[coinSymbol]) {
              coin[head.name] = coinsData[coinSymbol][head.name]
            } else {
              coin[head.name] = row[head.idx]
            }
          }
        })
        coins.push(Object.values(coin))
        return coins
      },
      [this.head.getHeaderAlias(this.head.price)]
    )
    this.updateHistoricalPrice(priceArray)
    portfolioPrice.deleteFilter().insertValues(priceArray).deleteEmptyRows()
  }

  updateHistoricalPrice(array = []) {
    const portfolioHistoricalPrice = new gas.GasWorkSheet(
      'portfolio',
      'historicalprice'
    )
    const newDate = new utils.FormatDate(new Date())
    const yyyymmdd = newDate.yyyymmdd
    const dateKey = new utils.Hash(yyyymmdd).md5
    const formatDate = newDate.getFormatDate('yyyy-MM-dd')
    const historicalPrice = portfolioHistoricalPrice.dataValues.filter(
      (row) => {
        return row[this.head.historicalPrice.dateKey.idx] !== dateKey
      }
    )

    historicalPrice.splice(
      0,
      0,
      Object.values(this.head.historicalPrice).map((m) => m.alias)
    )

    array.slice(1).forEach((row) => {
      const symbol = row[this.head.price.symbol.idx].toUpperCase()
      const pair = 'USD'
      const price = row[this.head.price.price.idx]
      const rowKey = new utils.Hash(yyyymmdd + symbol + pair).md5
      const symbolKey = new utils.Hash(symbol).md5
      const pairKey = new utils.Hash(pair).md5
      historicalPrice.push([
        rowKey,
        dateKey,
        symbolKey,
        pairKey,
        formatDate,
        symbol,
        pair,
        price,
      ])
    })
    portfolioHistoricalPrice
      .deleteFilter()
      .insertValues(historicalPrice)
      .deleteEmptyRows()
  }

  updateCoinList() {
    const portfolioCoinList = new gas.GasWorkSheet('portfolio', 'coinlist')
    const coinGeckoCoinList = new gas.GasWorkSheet(
      'coingecko',
      'coingecko token api list'
    )
    const coinList = [this.head.getHeaderAlias(this.head.coinList)]
    // new coinGecko.CoinsList(coinGeckoInstance)
    //   .getCoinsList()
    //   .forEach((coin) => {
    //     let rowHash = new utils.Hash('coingecko' + coin.symbol).md5
    //     coinList.push([rowHash, 'coingecko', coin.name, coin.symbol, coin.id])
    //   })
    coinGeckoCoinList.dataValues.forEach((coin) => {
      let rowHash = new utils.Hash('coingecko' + coin[1]).md5
      coinList.push([rowHash, 'coingecko', coin[2], coin[1], coin[0]])
    })
    new cryptoRank.CoinsList(cryptoRankInstance)
      .getCoinsList(15000)
      .forEach((coin) => {
        let rowHash = new utils.Hash('cryptorank' + coin.symbol).md5
        coinList.push([rowHash, 'cryptorank', coin.name, coin.symbol, coin.id])
      })
    new coinMarketCap.CoinsList(coinMarketCapInstance)
      .getCoinsList()
      .forEach((coin) => {
        let rowHash = new utils.Hash('coinmarketcap' + coin.symbol).md5
        coinList.push([
          rowHash,
          'coinmarketcap',
          coin.name,
          coin.symbol,
          coin.id,
        ])
      })

    Object.entries(
      new cryptoCompare.CoinsList(cryptoCompareInstance).getCoinsList()
    ).forEach((coin) => {
      let rowHash = new utils.Hash('cryptocompare' + coin[0]).md5
      coinList.push([
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
      let rowHash = new utils.Hash('cryptocompare' + coin[1]).md5
      coinList.push([rowHash, 'cryptocompare', coin[0], coin[1], coin[1]])
    })
    portfolioCoinList.deleteFilter().insertValues(coinList).deleteEmptyRows()
  }

  updateDataSet() {
    const portfolioAccount = new gas.GasWorkSheet('portfolio', 'account')
    const portfolioPrice = new gas.GasWorkSheet('portfolio', 'price')
    const portfolioDataset = new gas.GasWorkSheet('portfolio', 'dataset')
    const portfolioHistoricalPrice = new gas.GasWorkSheet(
      'portfolio',
      'historicalprice'
    )
    const coinPriceList = portfolioPrice.dataValues.reduce((list, row) => {
      const rowKey = new utils.Hash(row[this.head.price.symbol.idx]).md5
      if (!list[rowKey]) {
        list[rowKey] = row[this.head.price.price.idx]
      }
      return list
    }, {})
    const historicalCoinPriceList = portfolioHistoricalPrice.dataValues.reduce(
      (list, row) => {
        const rowKey = row[this.head.historicalPrice.rowKey.idx]
        if (!list[rowKey]) {
          list[rowKey] = row[this.head.historicalPrice.price.idx]
        }
        return list
      },
      {}
    )

    const dataSet = portfolioAccount.dataValues.reduce(
      (array, row) => {
        const rowData = {
          date: row[this.head.account.date.idx],
          time: row[this.head.account.time.idx],
          operation: row[this.head.account.operation.idx],
          account: row[this.head.account.account.idx],
          platform: row[this.head.account.platform.idx],
          service: row[this.head.account.service.idx],
          sender: row[this.head.account.sender.idx],
          recipient: row[this.head.account.recipient.idx],
          coin: row[this.head.account.coin.idx].toUpperCase(),
          coinQty: row[this.head.account.coinQty.idx],
          currency: row[this.head.account.currency.idx].toUpperCase(),
          currencyQty: row[this.head.account.currencyQty.idx],
          currencyPerCoin: row[this.head.account.currencyPerCoin.idx],
          feeCurrency: row[this.head.account.feeCurrency.idx].toUpperCase(),
          feeQty: row[this.head.account.feeQty.idx],
          comment: row[this.head.account.comment.idx],
        }
        if (rowData.date) {
          const yyyymmdd = new utils.FormatDate(rowData.date).yyyymmdd
          if (['Transfer'].indexOf(rowData.operation) !== -1) {
            array.push(
              Object.values({
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
                    new utils.Hash(yyyymmdd + rowData.coin + 'USD').md5
                  ] *
                  rowData.coinQty *
                  -1,
                currentCost:
                  coinPriceList[new utils.Hash(rowData.coin).md5] *
                  rowData.coinQty *
                  -1,
                comment: rowData.comment,
              })
            )
            array.push(
              Object.values({
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
                    new utils.Hash(yyyymmdd + rowData.coin + 'USD').md5
                  ] * rowData.coinQty,
                currentCost:
                  coinPriceList[new utils.Hash(rowData.coin).md5] *
                  rowData.coinQty,
                comment: rowData.comment,
              })
            )
          } else if (rowData.operation === 'Buy') {
            const coinQty = rowData.coinQty
              ? rowData.coinQty
              : rowData.currencyQty / rowData.currencyPerCoin
            array.push(
              Object.values({
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
                    new utils.Hash(yyyymmdd + rowData.currency + 'USD').md5
                  ] *
                  rowData.currencyQty *
                  -1,
                currentCost:
                  coinPriceList[new utils.Hash(rowData.currency).md5] *
                  rowData.currencyQty *
                  -1,
                comment: rowData.comment,
              })
            )
            array.push(
              Object.values({
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
                    new utils.Hash(yyyymmdd + rowData.coin + 'USD').md5
                  ] * coinQty,
                currentCost:
                  coinPriceList[new utils.Hash(rowData.coin).md5] * coinQty,
                comment: rowData.comment,
              })
            )
          } else if (rowData.operation === 'Sell') {
            const currencyQty = rowData.currencyQty
              ? rowData.currencyQty
              : rowData.coinQty * rowData.currencyPerCoin
            array.push(
              Object.values({
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
                    new utils.Hash(yyyymmdd + rowData.coin + 'USD').md5
                  ] *
                  rowData.coinQty *
                  -1,
                currentCost:
                  coinPriceList[new utils.Hash(rowData.coin).md5] *
                  rowData.coinQty *
                  -1,
                comment: rowData.comment,
              })
            )
            array.push(
              Object.values({
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
                    new utils.Hash(yyyymmdd + rowData.currency + 'USD').md5
                  ] * currencyQty,
                currentCost:
                  coinPriceList[new utils.Hash(rowData.currency).md5] *
                  currencyQty,
                comment: rowData.comment,
              })
            )
          }
        }
        return array
      },
      [this.head.getHeaderAlias(this.head.dataset)]
    )
    // console.log(ds)
    portfolioDataset.deleteFilter().insertValues(dataSet).deleteEmptyRows()
  }
}

function updateCoinPrice() {
  new Portfolio().updateCoinPrice()
}

function updateCoinList() {
  new Portfolio().updateCoinList()
}

function updateDataSet() {
  new Portfolio().updateDataSet()
}
