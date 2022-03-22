import { Environment } from '../../gas'
import { Header } from '../../header'
export { Portfolio }

new Environment([
  {
    spreadSheetName: 'portfolio',
    sheetId: '1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1iGoWj5YHB_iQi7o09-vJF6XJeveFI54lLOlx193Y0f8',
    scriptId: '19LYhtfrshQkWLvGQedmXFG4XJkcOR3cO9-E6Ne32GmKT766phfg71J_d',
    area: 'dev',
  },
])

class Portfolio {
  constructor() {
    if (Portfolio.exists) {
      return Portfolio.instance
    }
    Portfolio.instance = this
    Portfolio.exists = true
    this.header = new Header()
    this.head = {
      registry: {
        operation: { alias: 'Operation', idx: 0, notNull: true },
        accountSender: { alias: 'Account sender', idx: 1, notNull: true },
        accountRecipient: { alias: 'Account recipient', idx: 2 },
        project: { alias: 'Project', idx: 3 },
        platform: { alias: 'Platform', idx: 4, notNull: true },
        service: { alias: 'Service', idx: 5, notNull: true },
        sender: { alias: 'Sender', idx: 6, notNull: true },
        recipient: { alias: 'Recipient', idx: 7 },
        coin: { alias: 'Coin', idx: 8, notNull: true },
        coinQty: { alias: 'Coin, qty', idx: 9 },
        currency: { alias: 'Currency', idx: 10, notNull: true },
        currencyQty: { alias: 'Currency, qty', idx: 11 },
        currencyPerCoin: { alias: 'Currency per coin', idx: 12 },
        feeCurrency: { alias: 'Fee currency', idx: 13 },
        feeQty: { alias: 'Fee, qty', idx: 14 },
        comment: { alias: 'Comment', idx: 15 },
        date: { alias: 'Date', idx: 16, notNull: true },
        time: { alias: 'Time', idx: 17, notNull: true },
      },
      prices: {
        rowKey: { alias: 'Row key', idx: 0 },
        source: {
          alias: 'Source',
          idx: 1,
        },
        name: {
          alias: 'Name',
          idx: 2,
        },
        symbol: {
          alias: 'Symbol',
          pk: true,
          idx: 3,
        },
        risk: { alias: 'Risk', idx: 4 },
        id: { alias: 'Id', idx: 5 },
        price: { alias: 'Price', idx: 6 },
        // high24h: { alias: 'High 24h', idx: 6 },
        // low24h: { alias: 'Low 24h', idx: 7 },
        // percentChange24h: { alias: 'Change 24h, %', idx: 8 },
        // percentChange7d: { alias: 'Change 7d, %', idx: 9 },
        // percentChange30d: { alias: 'Change 30d, %', idx: 10 },
        // percentChange3m: { alias: 'Change 3m, %', idx: 11 },
        // percentChange6m: { alias: 'Change 6m, %', idx: 12 },
        // volume24h: { alias: 'Volume 24h', idx: 13 },
        // rank: { alias: 'Rank', idx: 14 },
        // type: { alias: 'Type', idx: 15 },
        // category: { alias: 'Category', idx: 16 },
        // circulatingSupply: { alias: 'Circulating supply', idx: 17 },
        // totalSupply: { alias: 'Total supply', idx: 18 },
        // maxSupply: { alias: 'Max supply', idx: 19 },
        // marketCap: { alias: 'Market cap', idx: 20 },
        // marketCapChange24h: { alias: 'Market cap change 24h', idx: 21 },
        // marketCapChangePercentage24h: {
        //   alias: 'Market cap change 24h, %',
        //   idx: 22,
        // },
        // fullyDilutedMarketCap: { alias: 'Fully diluted market cap', idx: 23 },
        // ath: { alias: 'All total high (ATH) price', idx: 24 },
        // athChangePercentage: { alias: 'ATH change, %', idx: 25 },
        // athDate: { alias: 'ATH date', idx: 256 },
        // atl: { alias: 'All total low (ATL) price', idx: 27 },
        // atlChangePercentage: { alias: 'ATL change, %', idx: 28 },
        // atlDate: { alias: 'ATL date', idx: 29 },
        // lastUpdated: { alias: 'Last updated', idx: 30 },
      },
      transactions: {
        rowKey: { alias: 'Row key', idx: 0 },
        dateTime: { alias: 'Date and time', idx: 1 },
        account: { alias: 'Account', idx: 2 },
        platform: { alias: 'Platform', idx: 3 },
        service: { alias: 'Service', idx: 4 },
        project: { alias: 'Project', idx: 5 },
        contractor: { alias: 'Contractor', idx: 6 },
        type: { alias: 'Type', idx: 7 },
        coin: { alias: 'Coin', idx: 8 },
        // pair: { alias: 'Pair', idx: 9 },
        // currencyPerCoin: { alias: 'Currency per coin', idx: 10 },
        quantity: { alias: 'Quantity', idx: 9 },
        // price: { alias: 'Price, $', idx: 11 },
        // cost: { alias: 'Cost, $', idx: 12 },
        comment: { alias: 'Comment', idx: 10 },
        actionKey: { alias: 'Action key', idx: 11 },
      },
      balance: {
        date: { alias: 'Date', idx: 0 },
        account: { alias: 'Account', idx: 1 },
        contractor: { alias: 'Contractor', idx: 2 },
        type: { alias: 'Type', idx: 3 },
        coin: { alias: 'Coin', idx: 4 },
        quantity: { alias: 'Quantity', idx: 5 },
        historicalCost: { alias: 'Historical cost, $', idx: 6 },
        currentCost: { alias: 'Current cost, $', idx: 7 },
      },
      allocation: {
        account: { alias: 'Account', idx: 0 },
        type: { alias: 'Type', idx: 1 },
        coin: { alias: 'Coin', idx: 2 },
        quantity: { alias: 'Quantity', idx: 3 },
        currentCost: { alias: 'Current cost, $', idx: 4 },
      },
      historicalPrices: {
        rowKey: { alias: 'Row key', idx: 0 },
        dateTime: { alias: 'Date and time', pk: true, idx: 1, type: 'date' },
        symbol: { alias: 'Coin', pk: true, idx: 2 },
        price: { alias: 'Price, $', idx: 3 },
      },
      coins: {
        rowKey: { alias: 'Row key', idx: 0 },
        source: { alias: 'Source', pk: true, idx: 1 },
        name: { alias: 'Name', pk: true, idx: 2 },
        symbol: { alias: 'Symbol', pk: true, idx: 3 },
        id: { alias: 'Id', idx: 4 },
      },
      sources: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
      },
      services: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
      },
      operations: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
      },
      project: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
      },
      contractors: {
        rowKey: { alias: 'Row key', idx: 0 },
        name: { alias: 'Name', pk: true, idx: 1 },
        type: { alias: 'Type', idx: 2 },
        category: { alias: 'Category', idx: 3 },
      },
    }
    this.spreadSheetName = 'portfolio'
  }
}
