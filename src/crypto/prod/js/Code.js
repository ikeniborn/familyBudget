var ss = SpreadsheetApp.openById('1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg')

function updatePrice() {
  const coins = ss
    .getSheetByName('Coins')
    .getDataRange()
    .getValues()
    .filter((f) => f[3])
    .map((m) => (m = m[0]))
    .join(',')
  const prices = coinGeckoLib.coinsMarkets('usd', coins)
  const data = []
  data.push(Object.keys(prices[0]))
  prices.forEach((coin) => {
    data.push(Object.values(coin))
  })
  const ws = ss.getSheetByName('Price')
  ws.clear()
  ws.getRange(1, 1, data.length, data[0].length).setValues(data)
}
