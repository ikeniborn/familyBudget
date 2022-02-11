class Header {
  constructor() {
    this.account = this.getNumAndIdx([
      'date',
      'time',
      'operation',
      'account',
      'platform',
      'service',
      'sender',
      'recipient',
      'coin',
      'coinQty',
      'currency',
      'currencyQty',
      'currencyPerCoin',
      'feeCurrency',
      'feeQty',
      'comment',
    ])
    this.price = this.getNumAndIdx([
      'name',
      'symbol',
      'source',
      'price',
      'high24h',
      'low24h',
      'percentChange24h',
      'percentChange7d',
      'percentChange30d',
      'percentChange3m',
      'percentChange6m',
      'rank',
      'type',
      'category',
      'circulatingSupply',
      'maxSupply',
      'volume24h',
      'marketCap',
      'fullyDilutedMarketCap',
      'lastUpdated',
    ])
    this.dataset = this.getNumAndIdx([
      'date',
      'account',
      'platform',
      'service',
      'contractor',
      'coin',
      'pair',
      'price',
      'quantity',
      'historicalCost',
      'currentCost',
      'comment',
    ])
    ;(this.hisoricalPrice = this.getNumAndIdx([
      'rowKey',
      'dateKey',
      'symbolKey',
      'pairKey',
      'date',
      'symbol',
      'pair',
      'price',
    ])),
      (this.coinList = this.getNumAndIdx([
        'rowKey',
        'source',
        'name',
        'symbol',
        'id',
      ]))
  }
  getNumAndIdx(array) {
    return array.reduce((obj, arr, idx) => {
      if (!obj[arr]) {
        obj[arr] = {}
      }
      obj[arr].num = idx + 1
      obj[arr].idx = idx
      obj[arr].name = arr
      return obj
    }, {})
  }
}
