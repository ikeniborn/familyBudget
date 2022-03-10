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

new gas.Environment([
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
    this.spreadSheet = {
      portfolio: new gas.SpreadSheet('portfolio'),
      fundamentalanalysis: new gas.SpreadSheet('fundamentalanalysis'),
      coingecko: new gas.SpreadSheet('coingecko'),
    }
    this.workSheet = {
      portfolio: {
        price: new gas.WorkSheet(this.spreadSheet.portfolio, 'prices'),
        registry: new gas.WorkSheet(this.spreadSheet.portfolio, 'registry'),
      },
      fundamentalanalysis: {
        price: new gas.WorkSheet(this.spreadSheet.fundamentalanalysis, 'price'),
      },
    }
  }
}

class Coin extends Portfolio {
  constructor() {
    super()
    this.workSheet.portfolio.coinsList = new gas.WorkSheet(
      this.spreadSheet.portfolio,
      'coins'
    )
  }
  updateCoinPrice() {
    const coinsList = this.workSheet.portfolio.coinsList.dataValues.reduce(
      (list, row) => {
        const rowKey = row[this.head.coinsList.rowKey.idx]
        const id = row[this.head.coinsList.id.idx]
        if (!list[rowKey]) {
          list[rowKey] = id
        }
        return list
      },
      {}
    )
    const listId = Object.fromEntries(
      Object.entries(
        this.workSheet.portfolio.price.dataValues
          .filter((f) => f[this.head.price.symbol.idx])
          .map(
            (m) =>
              (m = {
                name: m[this.head.price.name.idx],
                symbol: m[this.head.price.symbol.idx],
              })
          )
          .reduce((list, values) => {
            this.workSheet.portfolio.source.dataValues.forEach((source) => {
              if (!list[source]) {
                list[source] = []
              }
              const rowKey = new utils.Hash(
                source + values.name + values.symbol
              ).md5
              const coinId = coinsList[rowKey]
              if (coinId) {
                list[source].push(coinsList[rowKey])
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
          if (coin.values.USD.price) {
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
          }
        })
    }
    if (listId.coingecko) {
      new coinGecko.Price(coinGeckoInstance)
        .getMarketsPrice(listId.coingecko)
        .forEach((coin) => {
          const coinKey = coin.symbol.toUpperCase()
          if (coin.current_price) {
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
              marketCapChangePercentage24h:
                coin.market_cap_change_percentage_24h,
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
              lastUpdated: new utils.FormatDate(
                coin.last_updated
              ).getFormatDate('yyyy-MM-dd HH:mm'),
              source: 'CoinGecko',
              isNew: true,
            })
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
        if (coin.quote.USD.price) {
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
        if (coin[1].USD) {
          this.addCoinsData(coinKey, {
            symbol: coin[0],
            price: coin[1].USD,
            source: 'Cryptocompare',
            lastUpdated: new utils.FormatDate().getFormatDate(
              'yyyy-MM-dd HH:mm'
            ),
            isNew: true,
          })
        }
      })
    }

    const priceArray = this.workSheet.portfolio.price.dataValues.reduce(
      (coins, row) => {
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
      },
      []
    )
    this.workSheet.portfolio.price.insertValues(
      priceArray,
      this.head.getHeaderAlias(this.head.price)
    )

    this.workSheet.fundamentalanalysis.price.insertValues(
      priceArray,
      this.head.getHeaderAlias(this.head.price)
    )
  }

  updateCoinsList() {
    this.workSheet.coingecko.coingeckoTokenApiList = new gas.WorkSheet(
      this.spreadSheet.coingecko,
      'coingecko token api list'
    )
    const coinsList = []
    // new coinGecko.CoinsList(coinGeckoInstance)
    //   .getCoinsList()
    //   .forEach((coin) => {
    //     let rowHash = new utils.Hash('coingecko' + coin.symbol).md5
    //     coinsList.push([rowHash, 'coingecko', coin.name, coin.symbol, coin.id])
    //   })
    this.workSheet.coingecko
      .coingeckoTokenApiList()
      .dataValues.forEach((coin) => {
        const key = new utils.Hash('coingecko' + coin[2] + coin[1])
        coinsList.push([
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
        coinsList.push([
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
        coinsList.push([
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
      coinsList.push([
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
      coinsList.push([
        key.md5,
        key.string,
        'cryptocompare',
        coin[0],
        coin[1],
        coin[1],
      ])
    })
    this.workSheet.portfolio.coinsList.insertValues(
      coinsList,
      this.head.getHeaderAlias(this.head.coinsList)
    )
  }
}

class Transaction extends Portfolio {
  constructor() {
    super()
    this.workSheet.allocation = new gas.WorkSheet(
      this.spreadSheet.portfolio,
      'allocation'
    )
    this.workSheet.source = new gas.WorkSheet(
      this.spreadSheet.portfolio,
      'sources'
    )
    this.workSheet.historicalPrice = new gas.WorkSheet(
      this.spreadSheet.portfolio,
      'historicalprices'
    )
    this.workSheet.transaction = new gas.WorkSheet(
      this.spreadSheet.portfolio,
      'transactions'
    )
    this.workSheet.balance = new gas.WorkSheet(
      this.spreadSheet.portfolio,
      'balance'
    )
    this.workSheet.constractor = new gas.WorkSheet(
      this.spreadSheet.portfolio,
      'contractors'
    )
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

  updateTransactions() {
    const currentFormatDate = new utils.FormatDate()
    const transaction = []
    const contractor = this.workSheet.portfolio.constractor.dataValues.reduce(
      (dim, row) => {
        const type = row[this.head.contractor.type.idx]
        const name = new utils.Hash(row[this.head.contractor.name.idx])
        if (!dim[name.md5]) {
          dim[name.md5] = {
            name: name.stringUpperCase,
            type: type,
          }
        }
        return dim
      },
      {}
    )
    const currentCoinPrice = this.workSheet.portfolio.price.dataValues.reduce(
      (list, row) => {
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
      },
      {}
    )

    const historicalCoinPrice = this.workSheet.portfolio.historicalPrice.dataValues.reduce(
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

    this.workSheet.portfolio.registry.dataValues.forEach((row) => {
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
      const senderType =
        contractor[new utils.Hash(rowData.sender).md5]?.type || 'none'
      const recipientType =
        contractor[new utils.Hash(recipient).md5]?.type || 'none'
      if (rowData.date) {
        if (
          ['Transfer', 'Write-off', 'Refill'].indexOf(rowData.operation) !== -1
        ) {
          const currentCoinKey = new utils.Hash(
            currentFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const historicalCoinkey = new utils.Hash(
            historicalFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            this.getPrevHistoricalPrice(
              historicalCoinPrice,
              rowData.date,
              rowData.coin
            ) ||
            historicalCoinPrice[currentCoinKey.md5]?.price
          if (['Transfer', 'Write-off'].indexOf(rowData.operation) !== -1) {
            transactionRow.push({
              account: rowData.accountSender,
              contractor: rowData.sender,
              type: senderType,
              coin: rowData.coin,
              pair: rowData.coin,
              currencyPerCoin: 1,
              quantity: rowData.coinQty * -1,
              price: outPrice,
              cost: outPrice * rowData.coinQty * -1,
            })
          }
          if (['Transfer', 'Refill'].indexOf(rowData.operation) !== -1) {
            transactionRow.push({
              account: accountRecipient,
              contractor: recipient,
              type: recipientType,
              coin: rowData.coin,
              pair: rowData.coin,
              currencyPerCoin: 1,
              quantity: rowData.coinQty,
              price: outPrice,
              cost: outPrice * rowData.coinQty,
            })
          }
        } else if (['Buy'].indexOf(rowData.operation) !== -1) {
          let coinQty = rowData.coinQty
          let currencyQty = rowData.currencyQty
          if (coinQty && rowData.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowData.currencyPerCoin
          }
          if (!coinQty && rowData.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowData.currencyPerCoin
          }
          if (rowData.service === 'Liquidity pool') {
            coinQty /= 2
          }
          const currentCoinKey = new utils.Hash(
            currentFormatDate.yyyymmdd + rowData.currency + 'USD'
          )
          const historicalCoinkey = new utils.Hash(
            historicalFormatDate.yyyymmdd + rowData.currency + 'USD'
          )
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            this.getPrevHistoricalPrice(
              historicalCoinPrice,
              rowData.date,
              rowData.currency
            ) ||
            historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowData.accountSender,
            contractor: rowData.sender,
            type: senderType,
            coin: rowData.currency,
            pair: rowData.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty * -1,
            price: outPrice,
            cost: outPrice * currencyQty * -1,
          })
          const inPrice = (outPrice * currencyQty) / coinQty
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            type: recipientType,
            coin: rowData.coin,
            pair: rowData.currency,
            currencyPerCoin: rowData.currencyPerCoin
              ? rowData.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty,
            price: inPrice,
            cost: inPrice * coinQty,
          })
        } else if (['Sell'].indexOf(rowData.operation) !== -1) {
          let coinQty = rowData.coinQty
          let currencyQty = rowData.currencyQty
          if (coinQty && rowData.currencyPerCoin && !currencyQty) {
            currencyQty = coinQty * rowData.currencyPerCoin
          }
          if (!coinQty && rowData.currencyPerCoin && currencyQty) {
            coinQty = currencyQty / rowData.currencyPerCoin
          }
          if (rowData.service === 'Liquidity pool') {
            coinQty /= 2
          }
          const currentCoinKey = new utils.Hash(
            currentFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const historicalCoinkey = new utils.Hash(
            historicalFormatDate.yyyymmdd + rowData.coin + 'USD'
          )
          const outPrice =
            historicalCoinPrice[historicalCoinkey.md5]?.price ||
            this.getPrevHistoricalPrice(
              historicalCoinPrice,
              rowData.date,
              rowData.coin
            ) ||
            historicalCoinPrice[currentCoinKey.md5]?.price
          transactionRow.push({
            account: rowData.accountSender,
            contractor: rowData.sender,
            type: senderType,
            coin: rowData.coin,
            pair: rowData.currency,
            currencyPerCoin: rowData.currencyPerCoin
              ? rowData.currencyPerCoin
              : currencyQty / coinQty,
            quantity: coinQty * -1,
            price: outPrice,
            cost: outPrice * coinQty * -1,
          })
          const inPrice = (outPrice * coinQty) / currencyQty
          transactionRow.push({
            account: accountRecipient,
            contractor: recipient,
            type: recipientType,
            coin: rowData.currency,
            pair: rowData.coin,
            currencyPerCoin: coinQty / currencyQty,
            quantity: currencyQty,
            price: inPrice,
            cost: inPrice * currencyQty,
          })
        }
      }

      transactionRow.forEach((tx) => {
        const coinKey = new utils.Hash(
          historicalFormatDate.yyyymmdd + tx.coin + 'USD'
        )
        if (typeof tx.price === 'number') {
          historicalCoinPrice[coinKey.md5] = {
            rowKey: coinKey.md5,
            rowNkey: coinKey.stringUpperCase,
            dateKey: historicalFormatDate.md5,
            date: historicalFormatDate.getFormatDate('yyyy-MM-dd'),
            symbol: tx.coin,
            pair: 'USD',
            price: tx.price,
          }
        }

        transaction.push(
          Object.values({
            date: rowData.date,
            account: tx.account,
            platform: rowData.platform,
            service: rowData.service,
            contractor: tx.contractor,
            type: tx.type,
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
    this.workSheet.portfolio.historicalPrice.insertValues(
      historicalCoinPriceArray,
      this.head.getHeaderAlias(this.head.historicalPrice)
    )

    this.workSheet.portfolio.transaction.insertValues(
      transaction,
      this.head.getHeaderAlias(this.head.transaction)
    )
  }

  getPrevHistoricalPrice(historicalPrices, date, coin) {
    const prevHistoricalPrice = Object.entries(historicalPrices)
      .filter(([rowKey, row]) => {
        return new utils.Hash(row.symbol).md5 === new utils.Hash(coin).md5
      })
      .reduce((lastPrice, [rowKey, row]) => {
        if (
          new utils.FormatDate(row.date).yyyymmdd <=
            new utils.FormatDate(date).yyyymmdd &&
          row.price
        ) {
          lastPrice = row.price
        }
        return lastPrice
      }, 0)
    console.log(date, coin, prevHistoricalPrice)
    return prevHistoricalPrice ? prevHistoricalPrice : void 0
  }

  updateCustomPrice(lastHistoricalPrice = { date: '', price: 0 }) {
    const updatedCustomPrice = this.workSheet.portfolio.price.dataValues.map(
      (row) => {
        const lastCoinData =
          lastHistoricalPrice[
            new utils.Hash(row[this.head.price.symbol.idx]).md5
          ]
        if (
          (!row[this.head.price.price.idx] ||
            new Date(row[this.head.price.lastUpdated.idx]).valueOf() <
              new Date(lastCoinData.date).valueOf()) &&
          !row[this.head.price.source.idx]
        ) {
          row[this.head.price.price.idx] = lastCoinData?.price || 0
          row[this.head.price.lastUpdated.idx] =
            lastCoinData?.date || new Date()
        }
        return row
      }
    )
    this.workSheet.portfolio.price.insertValues(
      updatedCustomPrice,
      this.head.getHeaderAlias(this.head.price)
    )
  }

  updateBalance(
    transaction = [],
    lastCoinPrice = {},
    historicalCoinPrice = {}
  ) {
    const aggregationValues = transaction.reduce((target, source) => {
      const row = {
        date: new utils.FormatDate(
          source[this.head.transaction.date.idx]
        ).getFormatDate('yyyy-MM-dd'),
        account: source[this.head.transaction.account.idx].toUpperCase(),
        contractor: source[this.head.transaction.contractor.idx].toUpperCase(),
        type: source[this.head.transaction.type.idx].toUpperCase(),
        coin: source[this.head.transaction.coin.idx],
        quantity: source[this.head.transaction.quantity.idx],
      }

      if (!target['balance']) {
        target['balance'] = {}
      }
      if (!target['balance'][row.date]) {
        target['balance'][row.date] = {}
      }
      if (!target['balance'][row.date][row.account]) {
        target['balance'][row.date][row.account] = {}
      }
      if (!target['balance'][row.date][row.account][row.contractor]) {
        target['balance'][row.date][row.account][row.contractor] = {}
      }
      if (!target['balance'][row.date][row.account][row.contractor][row.type]) {
        target['balance'][row.date][row.account][row.contractor][row.type] = {}
      }
      if (
        !target['balance'][row.date][row.account][row.contractor][row.type][
          row.coin
        ]
      ) {
        target['balance'][row.date][row.account][row.contractor][row.type][
          row.coin
        ] = 0
      }
      target['balance'][row.date][row.account][row.contractor][row.type][
        row.coin
      ] += row.quantity

      if (!target['allocation']) {
        target['allocation'] = {}
      }
      if (!target['allocation'][row.account]) {
        target['allocation'][row.account] = {}
      }
      if (!target['allocation'][row.account][row.type]) {
        target['allocation'][row.account][row.type] = {}
      }
      if (!target['allocation'][row.account][row.type][row.coin]) {
        target['allocation'][row.account][row.type][row.coin] = 0
      }
      target['allocation'][row.account][row.type][row.coin] += row.quantity

      return target
    }, {})

    const balance = []
    Object.entries(aggregationValues.balance).forEach(([date, level0]) => {
      const yyyymmdd = new utils.FormatDate(date).yyyymmdd
      Object.entries(level0).forEach(([account, level1]) => {
        Object.entries(level1).forEach(([contractor, level2]) => {
          Object.entries(level2).forEach(([type, level3]) => {
            Object.entries(level3).forEach(([coin, quantity]) => {
              const currentPrice =
                lastCoinPrice[new utils.Hash(coin).md5]?.price
              const historicalPrice =
                historicalCoinPrice[new utils.Hash(yyyymmdd + coin + 'usd').md5]
                  ?.price
              const currentCost = quantity * currentPrice
              const historicalCost = quantity * historicalPrice
              balance.push([
                date,
                account,
                contractor,
                type,
                coin.toUpperCase(),
                quantity,
                historicalCost,
                currentCost,
              ])
            })
          })
        })
      })
    })

    const allocation = []
    Object.entries(aggregationValues.allocation).forEach(([account, type]) => {
      Object.entries(type).forEach(([type, coin]) => {
        Object.entries(coin).forEach(([coin, quantity]) => {
          const currentPrice = lastCoinPrice[new utils.Hash(coin).md5]?.price
          const currentCost = quantity * currentPrice
          allocation.push([
            account,
            type,
            coin.toUpperCase(),
            quantity,
            currentCost,
          ])
        })
      })
    })

    this.workSheet.portfolio.balance.insertValues(
      balance,
      this.head.getHeaderAlias(this.head.balance)
    )
    this.workSheet.portfolio.allocation.insertValues(
      allocation,
      this.head.getHeaderAlias(this.head.allocation)
    )
  }
}

class Registry extends Portfolio {
  constructor() {
    super()
  }
  updateUsdPerCurrency(editRange) {
    this.eMap = new Map(Object.entries(editRange))
    if (this.eMap.has('range')) {
      if (
        this.eMap.get('range').columnStart === this.head.registry.currency.num
      ) {
        const rowNum = this.eMap.get('range').rowStart
        const rowIndex = rowNum - 2
        const rowValues = this.workSheet.portfolio.registry.dataValues.filter(
          (row, index) => index === rowIndex
        )[0]
        const currency = rowValues[this.head.registry.currency.idx]
        const time = new utils.FormatNumber(
          rowValues[this.head.registry.time.idx]
        ).getHourAndMinuteFromNumber()
        const dateTime = new utils.FormatDate(
          rowValues[this.head.registry.date.idx]
        ).addTime(time.h, time.m).date
        const price = new cryptoCompare.Price(
          cryptoCompareInstance
        ).getHistoryPrice(currency, dateTime)[currency.toUpperCase()].USD
        this.workSheet.portfolio.registry.insertValue(
          price,
          rowNum,
          this.head.registry.usdPerCurrency.num
        )
      }
    }
  }
}

function updateCoinsPrice() {
  new Coin().updateCoinsPrice()
}

function updateCoinsList() {
  new Coin().updateCoinsList()
}

function updateTransactions() {
  new Transaction().updateTransactions()
}

function updateUsdPerCurrency(editRange) {
  new Registry().updateUsdPerCurrency(editRange)
}
