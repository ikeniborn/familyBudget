export { Header }
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
      accountSender: { alias: 'Account sender' },
      accountRecipient: { alias: 'Account recipient' },
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
      synonym: { alias: 'Synonym', permanent: true },
      price: { alias: 'Price' },
      high24h: { alias: 'High 24h' },
      low24h: { alias: 'Low 24h' },
      percentChange24h: { alias: 'Change 24h, %' },
      percentChange7d: { alias: 'Change 7d, %' },
      percentChange30d: { alias: 'Change 30d, %' },
      percentChange3m: { alias: 'Change 3m, %' },
      percentChange6m: { alias: 'Change 6m, %' },
      volume24h: { alias: 'Volume 24h' },
      rank: { alias: 'Rank' },
      type: { alias: 'Type' },
      category: { alias: 'Category' },
      circulatingSupply: { alias: 'Circulating supply' },
      totalSupply: { alias: 'Total supply' },
      maxSupply: { alias: 'Max supply' },
      marketCap: { alias: 'Market cap' },
      marketCapChange24h: { alias: 'Market cap change 24h' },
      marketCapChangePercentage24h: { alias: 'Market cap change 24h, %' },
      fullyDilutedMarketCap: { alias: 'Fully diluted market cap' },
      ath: { alias: 'All total high (ATH) price' },
      athChangePercentage: { alias: 'ATH change, %' },
      athDate: { alias: 'ATH date' },
      atl: { alias: 'All total low (ATL) price' },
      atlChangePercentage: { alias: 'ATL change, %' },
      atlDate: { alias: 'ATL date' },
      lastUpdated: { alias: 'Last updated' },
      source: { alias: 'Source' },
    })
    this.transaction = updateProps({
      date: { alias: 'Date' },
      account: { alias: 'Account' },
      platform: { alias: 'Platform' },
      service: { alias: 'Service' },
      contractor: { alias: 'Contractor' },
      coin: { alias: 'Coin' },
      pair: { alias: 'Pair' },
      currencyPerCoin: { alias: 'Currency per coin' },
      priceUsd: { alias: 'Price, $' },
      quantity: { alias: 'Quantity' },
      cost: { alias: 'Cost, $' },
      comment: { alias: 'Comment' },
    })
    this.balance = updateProps({
      date: { alias: 'Date' },
      account: { alias: 'Account' },
      contractor: { alias: 'Contractor' },
      coin: { alias: 'Coin' },
      quantity: { alias: 'Quantity' },
    })
    this.historicalPrice = updateProps({
      rowKey: { alias: 'Row key' },
      rownNkey: { alias: 'Row nkey' },
      dateKey: { alias: 'Date key' },
      date: { alias: 'Date' },
      symbol: { alias: 'Symbol' },
      pair: { alias: 'Pair' },
      price: { alias: 'Price' },
    })
    this.coinList = updateProps({
      rowKey: { alias: 'Row key' },
      rowNkey: { alias: 'Row nkey' },
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
