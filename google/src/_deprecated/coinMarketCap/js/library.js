function instance(apiKey) {
  new Instance(apiKey)
}

/**
 * Returns the latest market quote for 1 or more cryptocurrencies. Use the "convert" option to return market values in multiple fiat and cryptocurrency conversions in the same call.
 *
 * @param {string} ids One or more comma-separated cryptocurrency CoinMarketCap IDs. Example: 1,2
 * @param {string} convert Optionally calculate market quotes in up to 120 currencies at once by passing a comma-separated list of cryptocurrency or fiat currency symbols. Each additional convert option beyond the first requires an additional call credit. A list of supported fiat options can be found here. Each conversion is returned in its own "quote" object.
 * @returns {object}
 */
function quotesLatest(id, convert) {
  return new Cryptocurrency().quotesLatest(id, convert)
}

function mapList() {
  return new Cryptocurrency().mapList()
}
