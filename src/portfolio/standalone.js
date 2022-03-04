import * as cryptoRank from '../restApi/cryptoRank'
// import * as exchangeRatesApi from '../../../src/restApi/exchangeRatesApi'
import * as cryptoCompare from '../restApi/cryptoCompare'
import * as coinMarketCap from '../restApi/coinMarketCap'
import * as coinGecko from '../restApi/coinGecko'
import * as gas from '../gas'
import * as utils from '../utils'
import * as bscScan from '../restApi/bscScan'

import { Header } from './header'

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

const bscScanKey = 'WBG2AFT4SQ4WKKIAPB4P3Y6BMKDTV1UNZU'

new gas.GasEnvironment([
  {
    spreadSheetName: 'portfolio',
    sheetId: '1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'coingecko',
    sheetId: '1wTTuxXt8n9q7C4NDXqQpI3wpKu1_5bGVmP9Xz0XGSyU',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'fundamentalAnalysis',
    sheetId: '1c9Mvwd8KrhUKIs7sPPrSxfKzOdz1Zen6QbOezvVMCao',
    scriptId: '12V0O6ymxbRKl1WP9HiwHwLqEvieD0J45DmRtv-JRKX0darmv97FIaFAP',
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
    scriptId: '1HVxNmr_vVQNl6DS1g1aBscXDTJSmGdHRkxBAzAmqaasvs7y7hnTZvh7y',
    area: 'dev',
  },
  {
    spreadSheetName: 'fundamentalAnalysis',
    sheetId: '1TMpFQVHHk1-FMlq1AbNjqXZ-kamiM5XqVvppcnll62o',
    scriptId: '1aKtMlxaAVvpbzGINbr-oTJvOl1NtklpFr_dmLFVcZIHocTIfNcCeHwWk',
    area: 'dev',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1HdeIaXO5WjYOvyv02CgQi3IDpb95YYDt5zYAPLF2IJA',
    scriptId: '1wMVtZ4j0rNITU7AO7Iw_ShreekQ3bSdKpk-pixV4M1EGRdhNSUCcXmUO',
    area: 'dev',
  },
])

class Portfolio {
  constructor() {
    this.head = new Header()
    this.coinsData = {}
  }

  addCoinsData(coinKey, data) {
    if (!this.coinsData[coinKey]) {
      this.coinsData[coinKey] = data
    } else {
      Object.entries(data).forEach((column) => {
        const head = column[0]
        const value = column[1]
        if (!this.coinsData[coinKey][head]) {
          this.coinsData[coinKey][head] = value
        }
      })
    }
  }
  updateCoinPrice() {
    const portfolioPrice = new gas.GasWorkSheet('portfolio', 'price')
    const portfolioCoinList = new gas.GasWorkSheet('portfolio', 'coinlist')
    const portfolioSource = new gas.GasWorkSheet('portfolio', 'source')
    const fundamentalAnalysis = new gas.GasWorkSheet(
      'fundamentalanalysis',
      'price'
    )
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
                name: m[this.head.price.name.idx],
                symbol: m[this.head.price.symbol.idx],
              })
          )
          .reduce((list, values) => {
            portfolioSource.dataValues.forEach((source) => {
              if (!list[source]) {
                list[source] = []
              }
              const rowKey = new utils.Hash(
                source + values.name + values.symbol
              ).md5
              const coinId = coinList[rowKey]
              if (coinId) {
                list[source].push(coinList[rowKey])
              }
            })
            return list
          }, {})
      ).map((m) => (m = [m[0], m[1].join(',')]))
    )

    if (listId.cryptorank) {
      new cryptoRank.Price(cryptoRankInstance)
        .getLastPrice(listId.cryptorank)
        .forEach((coin) => {
          const coinKey = coin.symbol.toUpperCase()
          this.addCoinsData(coinKey, {
            id: coin.id,
            slug: coin.slug,
            symbol: coin.symbol,
            name: coin.name,
            price: coin.values.USD.price,
            high24h: coin.values.USD.high24h,
            low24h: coin.values.USD.low24h,
            percentChange24h: coin.values.USD.percentChange24h,
            percentChange7d: coin.values.USD.percentChange7d,
            percentChange30d: coin.values.USD.percentChange30d,
            percentChange3m: coin.values.USD.percentChange3m,
            percentChange6m: coin.values.USD.percentChange6m,
            volume24h: coin.values.USD.volume24h,
            rank: coin.rank,
            type: coin.type,
            category: coin.category,
            circulatingSupply: coin.circulatingSupply,
            totalSupply: coin.totalSupply,
            maxSupply: coin.maxSupply,
            marketCap: coin.values.USD.marketCap,
            lastUpdated: new utils.FormatDate(coin.lastUpdated).getFormatDate(
              'yyyy-MM-dd HH:mm'
            ),
            source: 'CryptoRank',
            isNew: true,
          })
        })
    }
    if (listId.coingecko) {
      new coinGecko.Price(coinGeckoInstance)
        .getMarketsPrice(listId.coingecko)
        .forEach((coin) => {
          const coinKey = coin.symbol.toUpperCase()
          this.addCoinsData(coinKey, {
            id: coin.id,
            slug: coin.id,
            symbol: coin.symbol,
            name: coin.name,
            price: coin.current_price,
            high24h: coin.high_24h,
            low24h: coin.low_24h,
            percentChange24h: coin.price_change_percentage_24h_in_currency,
            percentChange7d: coin.price_change_percentage_7d_in_currency,
            percentChange30d: coin.price_change_percentage_30d_in_currency,
            volume24h: coin.total_volume,
            rank: coin.market_cap_rank,
            type: coin.type,
            marketCap: coin.market_cap,
            marketCapChange24h: coin.market_cap_change_24h,
            marketCapChangePercentage24h: coin.market_cap_change_percentage_24h,
            maxSupply: coin.max_supply,
            circulatingSupply: coin.circulating_supply,
            totalSupply: coin.total_supply,
            fullyDilutedMarketCap: coin.fully_diluted_valuation,
            ath: coin.ath,
            athChangePercentage: coin.ath_change_percentage,
            athDate: new utils.FormatDate(coin.ath_date).getFormatDate(
              'yyyy-MM-dd HH:mm'
            ),
            atl: coin.atl,
            atlChangePercentage: coin.atl_change_percentage,
            atlDate: new utils.FormatDate(coin.atl_date).getFormatDate(
              'yyyy-MM-dd HH:mm'
            ),
            lastUpdated: new utils.FormatDate(coin.last_updated).getFormatDate(
              'yyyy-MM-dd HH:mm'
            ),
            source: 'CoinGecko',
            isNew: true,
          })
        })
    }
    if (listId.coinmarketcap) {
      Object.values(
        new coinMarketCap.Price(coinMarketCapInstance).getLastPrice(
          listId.coinmarketcap
        )
      ).forEach((coin) => {
        const coinKey = coin.symbol.toUpperCase()
        this.addCoinsData(coinKey, {
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
          volume24h: coin.quote.USD.volume_24h,
          volumeChange24h: coin.quote.USD.volume_change_24h,
          marketCap: coin.quote.USD.market_cap,
          percentChange24h: coin.quote.USD.percent_change_24h,
          percentChange7d: coin.quote.USD.percent_change_7d,
          percentChange30d: coin.quote.USD.percent_change_30d,
          marketCapDominance: coin.quote.USD.market_cap_dominance,
          fullyDilutedMarketCap: coin.quote.USD.fully_diluted_market_cap,
          lastUpdated: new utils.FormatDate(coin.last_updated).getFormatDate(
            'yyyy-MM-dd HH:mm'
          ),
          source: 'CoinMarketCap',
          isNew: true,
        })
      })
    }
    if (listId.cryptocompare) {
      Object.entries(
        new cryptoCompare.Price(cryptoCompareInstance).getMultiPrice(
          listId.cryptocompare
        )
      ).forEach((coin) => {
        const coinKey = coin[0].toUpperCase()
        this.addCoinsData(coinKey, {
          symbol: coin[0],
          price: coin[1].USD,
          source: 'Cryptocompare',
          lastUpdated: new utils.FormatDate().getFormatDate('yyyy-MM-dd HH:mm'),
          isNew: true,
        })
      })
    }

    const priceArray = portfolioPrice.dataValues.reduce((coins, row) => {
      const coin = {}
      const coinSymbol = row[this.head.price.symbol.idx].toUpperCase()
      Object.values(this.head.price).forEach((head) => {
        if (head.permanent) {
          coin[head.name] = row[head.idx]
        } else {
          if (this.coinsData[coinSymbol]) {
            coin[head.name] = this.coinsData[coinSymbol][head.name]
          } else {
            coin[head.name] = row[head.idx]
          }
        }
      })
      coins.push(Object.values(coin))
      return coins
    }, [])
    portfolioPrice
      .deleteFilter()
      .insertValues(priceArray, this.head.getHeaderAlias(this.head.price))
      .deleteEmptyRows()
      .deleteEmptyColumns()
    fundamentalAnalysis
      .deleteFilter()
      .insertValues(priceArray, this.head.getHeaderAlias(this.head.price))
      .deleteEmptyRows()
      .deleteEmptyColumns()
  }

  updateHistoricalPriceKey() {
    const portfolioHistoricalPrice = new gas.GasWorkSheet(
      'portfolio',
      'historicalprice'
    )
    const newDate = new utils.FormatDate(new Date())
    const yyyymmdd = newDate.yyyymmdd
    const dateKey = new utils.Hash(yyyymmdd).md5
    const formatDate = newDate.getFormatDate('yyyy-MM-dd')
    const pair = 'USD'
    const historicalPrice = portfolioHistoricalPrice.dataValues.reduce(
      (newArray, oldArray) => {
        const date = new utils.FormatDate(
          oldArray[this.head.historicalPrice.date.idx]
        )
        const dateKey = new utils.Hash(date.yyyymmdd).md5
        const symbol = oldArray[
          this.head.historicalPrice.symbol.idx
        ].toUpperCase()
        const pair = oldArray[this.head.historicalPrice.pair.idx].toUpperCase()
        const price = oldArray[this.head.historicalPrice.price.idx]
        const key = new utils.Hash(date.yyyymmdd + symbol + pair)
        newArray.push([
          key.md5,
          key.string,
          dateKey,
          date.getFormatDate('yyyy-MM-dd'),
          symbol,
          pair,
          price,
        ])
        return newArray
      },
      [this.head.getHeaderAlias(this.head.historicalPrice)]
    )
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
      const key = new utils.Hash('coingecko' + coin[2] + coin[1])
      coinList.push([
        key.md5,
        key.string,
        'coingecko',
        coin[2],
        coin[1],
        coin[0],
      ])
    })
    new cryptoRank.CoinsList(cryptoRankInstance)
      .getCoinsList(15000)
      .forEach((coin) => {
        const key = new utils.Hash('cryptorank' + coin.name + coin.symbol)
        coinList.push([
          key.md5,
          key.string,
          'cryptorank',
          coin.name,
          coin.symbol,
          coin.id,
        ])
      })
    new coinMarketCap.CoinsList(coinMarketCapInstance)
      .getCoinsList()
      .forEach((coin) => {
        const key = new utils.Hash('coinmarketcap' + coin.name + coin.symbol)
        coinList.push([
          key.md5,
          key.string,
          'coinmarketcap',
          coin.name,
          coin.symbol,
          coin.id,
        ])
      })

    Object.entries(
      new cryptoCompare.CoinsList(cryptoCompareInstance).getCoinsList()
    ).forEach((coin) => {
      const key = new utils.Hash('cryptocompare' + coin[1].CoinName + coin[0])
      coinList.push([
        key.md5,
        key.string,
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
      const key = new utils.Hash('cryptocompare' + coin[0] + coin[1])
      coinList.push([
        key.md5,
        key.string,
        'cryptocompare',
        coin[0],
        coin[1],
        coin[1],
      ])
    })
    portfolioCoinList.deleteFilter().insertValues(coinList).deleteEmptyRows()
  }

  updateTransaction() {
    const portfolioAccount = new gas.GasWorkSheet('portfolio', 'account')
    const portfolioTransaction = new gas.GasWorkSheet(
      'portfolio',
      'transaction'
    )
    const portfolioHistoricalPrice = new gas.GasWorkSheet(
      'portfolio',
      'historicalprice'
    )
    const portfolioPrice = new gas.GasWorkSheet('portfolio', 'price')
    const currentFormatDate = new utils.FormatDate()
    const transaction = []
    const currentCoinPrice = portfolioPrice.dataValues.reduce((list, row) => {
      const key = new utils.Hash(
        currentFormatDate.yyyymmdd + row[this.head.price.symbol.idx] + 'USD'
      )
      if (row[this.head.price.price.idx]) {
        list[key.md5] = {
          rowKey: key.md5,
          rowNkey: key.stringUpperCase,
          dateKey: currentFormatDate.md5,
          date: currentFormatDate.getFormatDate('yyyy-MM-dd'),
          symbol: row[this.head.price.symbol.idx].toUpperCase(),
          pair: 'USD',
          price: row[this.head.price.price.idx],
        }
      }
      return list
    }, {})

    const historicalCoinPrice = portfolioHistoricalPrice.dataValues.reduce(
      (list, row) => {
        const rowKey = row[this.head.historicalPrice.rowKey.idx]
        if (!list[rowKey]) {
          list[rowKey] = {
            rowKey: row[this.head.historicalPrice.rowKey.idx],
            rowNkey: row[this.head.historicalPrice.rowNkey.idx],
            dateKey: row[this.head.historicalPrice.dateKey.idx],
            date: row[this.head.historicalPrice.date.idx],
            symbol: row[this.head.historicalPrice.symbol.idx],
            pair: row[this.head.historicalPrice.pair.idx],
            price: row[this.head.historicalPrice.price.idx],
          }
        }
        return list
      },
      currentCoinPrice
    )

    portfolioAccount.dataValues.forEach((row) => {
      const transactionRow = []
      const rowData = {
        date: row[this.head.account.date.idx],
        time: row[this.head.account.time.idx],
        operation: row[this.head.account.operation.idx],
        accountSender: row[this.head.account.accountSender.idx],
        accountRecipient: row[this.head.account.accountRecipient.idx],
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
      const historicalFormatDate = new utils.FormatDate(rowData.date)
      const accountRecipient = rowData.accountRecipient
        ? rowData.accountRecipient
        : rowData.accountSender
      const recipient = rowData.recipient ? rowData.recipient : rowData.sender
      if (rowData.date) {
        if (['Transfer'].indexOf(rowData.operation) !== -1) {
          const currentCoinKey = new utils.Hash(
            currentFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const historicalCoinkey = new utils.Hash(
            historicalFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowData.accountSender,
            contractor: rowData.sender,
            coin: rowData.coin,
            pair: rowData.coin,
            currencyPerCoin: 1,
            quantity: rowData.coinQty * -1,
            price: outPrice,
            cost: outPrice * rowData.coinQty * -1,
          })

          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            coin: rowData.coin,
            pair: rowData.coin,
            currencyPerCoin: 1,
            quantity: rowData.coinQty,
            price: outPrice,
            cost: outPrice * rowData.coinQty,
          })
        } else if (['Claim'].indexOf(rowData.operation) !== -1) {
          const currentCoinKey = new utils.Hash(
            currentFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const historicalCoinkey = new utils.Hash(
            historicalFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            coin: rowData.coin,
            pair: rowData.coin,
            currencyPerCoin: 1,
            quantity: rowData.coinQty,
            price: outPrice,
            cost: outPrice * rowData.coinQty,
          })
        } else if (['Add', 'Buy'].indexOf(rowData.operation) !== -1) {
          let coinQty = rowData.coinQty
          let currencyQty = rowData.currencyQty
          if (coinQty) {
            if (rowData.service === 'Liquidity pool') {
              coinQty /= 2
            }
            if (!rowData.currencyQty) {
              currencyQty = coinQty * rowData.currencyPerCoin
            }
          } else {
            coinQty = currencyQty / rowData.currencyPerCoin
          }
          const currentCoinKey = new utils.Hash(
            currentFormatDate.yyyymmdd + rowData.currency + 'USD'
          )
          const historicalCoinkey = new utils.Hash(
            historicalFormatDate.yyyymmdd + rowData.currency + 'USD'
          )
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowData.accountSender,
            contractor: rowData.sender,
            coin: rowData.currency,
            pair: rowData.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty * -1,
            price: outPrice,
            cost: outPrice * currencyQty * -1,
          })
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            coin: rowData.coin,
            pair: rowData.currency,
            currencyPerCoin: rowData.currencyPerCoin
              ? rowData.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty,
            price: (outPrice * currencyQty) / coinQty,
            cost: ((outPrice * currencyQty) / coinQty) * coinQty,
          })
        } else if (['Remove', 'Sell'].indexOf(rowData.operation) !== -1) {
          let coinQty = rowData.coinQty
          let currencyQty = rowData.currencyQty
          if (currencyQty) {
            if (rowData.service === 'Liquidity pool') {
              currencyQty /= 2
            }
          } else {
            currencyQty = coinQty * rowData.currencyPerCoin
          }
          const currentCoinKey = new utils.Hash(
            currentFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const historicalCoinkey = new utils.Hash(
            historicalFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowData.accountSender,
            contractor: rowData.sender,
            coin: rowData.coin,
            pair: rowData.currency,
            currencyPerCoin: rowData.currencyPerCoin
              ? rowData.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty * -1,
            price: outPrice,
            cost: outPrice * coinQty * -1,
          })
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            coin: rowData.currency,
            pair: rowData.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty,
            price: (outPrice * coinQty) / currencyQty,
            cost: ((outPrice * coinQty) / currencyQty) * currencyQty,
          })
        }
      }

      transactionRow.forEach((tx) => {
        const coinKey = new utils.Hash(
          historicalFormatDate.yyyymmdd + tx.coin + 'USD'
        )
        historicalCoinPrice[coinKey.md5] = {
          rowKey: coinKey.md5,
          rowNkey: coinKey.stringUpperCase,
          dateKey: historicalFormatDate.md5,
          date: historicalFormatDate.getFormatDate('yyyy-MM-dd'),
          symbol: tx.coin,
          pair: 'USD',
          price: tx.price,
        }
        transaction.push(
          Object.values({
            date: rowData.date,
            account: tx.account,
            platform: rowData.platform,
            service: rowData.service,
            contractor: tx.contractor,
            coin: tx.coin,
            pair: tx.pair,
            currencyPerCoin: tx.currencyPerCoin,
            price: tx.price,
            quantity: tx.quantity,
            cost: tx.cost,
            comment: rowData.comment,
          })
        )
      })
    })

    const historicalCoinPriceArray = Object.values(historicalCoinPrice)
      .map((m) => (m = Object.values(m)))
      .sort((a, b) => {
        return (
          new Date(a[this.head.historicalPrice.date.idx]).valueOf() -
          new Date(b[this.head.historicalPrice.date.idx]).valueOf()
        )
      })

    const lastCoinPrice = historicalCoinPriceArray.reduce((target, source) => {
      const row = {
        date: new utils.FormatDate(
          source[this.head.historicalPrice.date.idx]
        ).getFormatDate('yyyy-MM-dd'),
        coinKey: new utils.Hash(source[this.head.historicalPrice.symbol.idx])
          .md5,
        price: source[this.head.historicalPrice.price.idx],
      }
      if (!target[row.coinKey]) {
        target[row.coinKey] = { date: row.date, price: row.price }
      }
      if (
        new Date(target[row.coinKey].date).valueOf() <
          new Date(row.date).valueOf() &&
        row.price
      ) {
        target[row.coinKey] = { date: row.date, price: row.price }
      }
      return target
    }, {})
    this.updateCustomPrice(lastCoinPrice)
    this.updateBalance(transaction, lastCoinPrice, historicalCoinPrice)
    portfolioHistoricalPrice
      .deleteFilter()
      .insertValues(
        historicalCoinPriceArray,
        this.head.getHeaderAlias(this.head.historicalPrice)
      )
      .deleteEmptyRows()
      .deleteEmptyColumns()

    portfolioTransaction
      .deleteFilter()
      .insertValues(
        transaction,
        this.head.getHeaderAlias(this.head.transaction)
      )
      .deleteEmptyRows()
      .deleteEmptyColumns()
  }

  updateCustomPrice(lastHistoricalPrice = { date: '', price: 0 }) {
    const portfolioPrice = new gas.GasWorkSheet('portfolio', 'price')
    const updatedCustomPrice = portfolioPrice.dataValues.map((row) => {
      const lastCoinData =
        lastHistoricalPrice[new utils.Hash(row[this.head.price.symbol.idx]).md5]
      if (
        (!row[this.head.price.price.idx] ||
          new Date(row[this.head.price.lastUpdated.idx]).valueOf() <
            new Date(lastCoinData.date).valueOf()) &&
        !row[this.head.price.source.idx]
      ) {
        row[this.head.price.price.idx] = lastCoinData.price
        row[this.head.price.lastUpdated.idx] = lastCoinData.date
      }
      return row
    })
    portfolioPrice
      .deleteFilter()
      .insertValues(
        updatedCustomPrice,
        this.head.getHeaderAlias(this.head.price)
      )
      .deleteEmptyRows()
      .deleteEmptyColumns()
  }

  updateBalance(
    transaction = [],
    lastCoinPrice = {},
    historicalCoinPrice = {}
  ) {
    const portfolioBalance = new gas.GasWorkSheet('portfolio', 'balance')
    const balanceAgg = transaction.reduce((target, source) => {
      const row = {
        date: new utils.FormatDate(
          source[this.head.transaction.date.idx]
        ).getFormatDate('yyyy-MM-dd'),
        account: source[this.head.transaction.account.idx].toUpperCase(),
        contractor: source[this.head.transaction.contractor.idx].toUpperCase(),
        coin: source[this.head.transaction.coin.idx],
        quantity: source[this.head.transaction.quantity.idx],
      }
      if (!target[row.date]) {
        target[row.date] = {}
      }
      if (!target[row.date][row.account]) {
        target[row.date][row.account] = {}
      }
      if (!target[row.date][row.account][row.contractor]) {
        target[row.date][row.account][row.contractor] = {}
      }
      if (!target[row.date][row.account][row.contractor][row.coin]) {
        target[row.date][row.account][row.contractor][row.coin] = 0
      }

      target[row.date][row.account][row.contractor][row.coin] += row.quantity

      return target
    }, {})
    const balance = []
    Object.entries(balanceAgg).forEach((level0) => {
      const date = level0[0]
      const yyyymmdd = new utils.FormatDate(date).yyyymmdd
      Object.entries(level0[1]).forEach((level1) => {
        const account = level1[0]
        Object.entries(level1[1]).forEach((level2) => {
          const contractor = level2[0]
          Object.entries(level2[1]).forEach((level3) => {
            const symbol = level3[0].toUpperCase()
            const currentPrice =
              lastCoinPrice[new utils.Hash(symbol).md5]?.price
            const historicalPrice =
              historicalCoinPrice[new utils.Hash(yyyymmdd + symbol + 'usd').md5]
                ?.price
            const quantity = level3[1]
            const currentCost = quantity * currentPrice
            const historicalCost = quantity * historicalPrice

            // if (quantity) {
            balance.push([
              date,
              account,
              contractor,
              symbol,
              quantity,
              historicalCost,
              currentCost,
            ])
            // }
          })
        })
      })
    })

    portfolioBalance
      .deleteFilter()
      .insertValues(balance, this.head.getHeaderAlias(this.head.balance))
      .deleteEmptyRows()
      .deleteEmptyColumns()
  }
}

function updateCoinPrice() {
  new Portfolio().updateCoinPrice()
}

function updateCoinList() {
  new Portfolio().updateCoinList()
}

function updateTransaction() {
  new Portfolio().updateTransaction()
}

function updateHistoricalPriceKey() {
  new Portfolio().updateHistoricalPriceKey()
}
