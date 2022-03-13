export { Header }

class Header {
  constructor() {
    this.registry = {
      date: { alias: 'Date', idx: 0 },
      time: { alias: 'Time', idx: 1 },
      operation: { alias: 'Operation', idx: 2 },
      accountSender: { alias: 'Account sender', idx: 3 },
      accountRecipient: { alias: 'Account recipient', idx: 4 },
      platform: { alias: 'Platform', idx: 5 },
      service: { alias: 'Service', idx: 6 },
      sender: { alias: 'Sender', idx: 7 },
      recipient: { alias: 'Recipient', idx: 8 },
      coin: { alias: 'Coin', idx: 9 },
      coinQty: { alias: 'Coin, qty', idx: 10 },
      currency: { alias: 'Currency', idx: 11 },
      currencyQty: { alias: 'Currency, qty', idx: 12 },
      currencyPerCoin: { alias: 'Currency per coin', idx: 13 },
      feeCurrency: { alias: 'Fee currency', idx: 14 },
      feeQty: { alias: 'Fee, qty', idx: 15 },
      comment: { alias: 'Comment', idx: 16 },
    }
    this.prices = {
      name: { alias: 'Name', permanent: true, pk: true, idx: 0 },
      symbol: { alias: 'Symbol', permanent: true, pk: true, idx: 2 },
      risk: { alias: 'Risk', permanent: true, idx: 3 },
      price: { alias: 'Price', idx: 4 },
      high24h: { alias: 'High 24h', idx: 5 },
      low24h: { alias: 'Low 24h', idx: 6 },
      percentChange24h: { alias: 'Change 24h, %', idx: 7 },
      percentChange7d: { alias: 'Change 7d, %', idx: 8 },
      percentChange30d: { alias: 'Change 30d, %', idx: 9 },
      percentChange3m: { alias: 'Change 3m, %', idx: 10 },
      percentChange6m: { alias: 'Change 6m, %', idx: 11 },
      volume24h: { alias: 'Volume 24h', idx: 12 },
      rank: { alias: 'Rank', idx: 13 },
      type: { alias: 'Type', idx: 14 },
      category: { alias: 'Category', idx: 15 },
      circulatingSupply: { alias: 'Circulating supply', idx: 16 },
      totalSupply: { alias: 'Total supply', idx: 17 },
      maxSupply: { alias: 'Max supply', idx: 18 },
      marketCap: { alias: 'Market cap', idx: 19 },
      marketCapChange24h: { alias: 'Market cap change 24h', idx: 20 },
      marketCapChangePercentage24h: {
        alias: 'Market cap change 24h, %',
        idx: 21,
      },
      fullyDilutedMarketCap: { alias: 'Fully diluted market cap', idx: 22 },
      ath: { alias: 'All total high (ATH) price', idx: 23 },
      athChangePercentage: { alias: 'ATH change, %', idx: 24 },
      athDate: { alias: 'ATH date', idx: 25 },
      atl: { alias: 'All total low (ATL) price', idx: 26 },
      atlChangePercentage: { alias: 'ATL change, %', idx: 27 },
      atlDate: { alias: 'ATL date', idx: 28 },
      lastUpdated: { alias: 'Last updated', idx: 29 },
      source: { alias: 'Source', idx: 30 },
    }
    this.transactions = {
      rowNum: { alias: 'Row num', idx: 0 },
      rowHash: { alias: 'Row hash', idx: 1 },
      date: { alias: 'Date', idx: 2 },
      account: { alias: 'Account', idx: 3 },
      platform: { alias: 'Platform', idx: 4 },
      service: { alias: 'Service', idx: 5 },
      contractor: { alias: 'Contractor', idx: 6 },
      type: { alias: 'Type', idx: 7 },
      coin: { alias: 'Coin', idx: 8 },
      pair: { alias: 'Pair', idx: 9 },
      currencyPerCoin: { alias: 'Currency per coin', idx: 10 },
      quantity: { alias: 'Quantity', idx: 11 },
      price: { alias: 'Price, $', idx: 12 },
      cost: { alias: 'Cost, $', idx: 13 },
      comment: { alias: 'Comment', idx: 14 },
    }
    this.balance = {
      date: { alias: 'Date', idx: 0 },
      account: { alias: 'Account', idx: 1 },
      contractor: { alias: 'Contractor', idx: 2 },
      type: { alias: 'Type', idx: 3 },
      coin: { alias: 'Coin', idx: 4 },
      quantity: { alias: 'Quantity', idx: 5 },
      historicalCost: { alias: 'Historical cost, $', idx: 6 },
      currentCost: { alias: 'Current cost, $', idx: 7 },
    }
    this.allocation = {
      account: { alias: 'Account', idx: 0 },
      type: { alias: 'Type', idx: 1 },
      coin: { alias: 'Coin', idx: 2 },
      quantity: { alias: 'Quantity', idx: 3 },
      currentCost: { alias: 'Current cost, $', idx: 4 },
    }
    this.historicalPrices = {
      date: { alias: 'Date', pk: true, idx: 0, type: 'date' },
      symbol: { alias: 'Symbol', pk: true, idx: 1 },
      pair: { alias: 'Pair', pk: true, idx: 2 },
      price: { alias: 'Price', idx: 3 },
    }
    this.coins = {
      source: { alias: 'Source', pk: true, idx: 2 },
      name: { alias: 'Name', pk: true, idx: 3 },
      symbol: { alias: 'Symbol', pk: true, idx: 4 },
      id: { alias: 'Id', idx: 5 },
    }
    this.sources = {
      name: { alias: 'Name', pk: true, idx: 0 },
    }
    this.contractors = {
      name: { alias: 'Name', pk: true, idx: 0 },
      type: { alias: 'Type', idx: 1 },
      category: { alias: 'Category', idx: 2 },
    }
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
