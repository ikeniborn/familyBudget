function instance(api_key) {
  new Instance(api_key)
}

/**
 * Get the current price of any cryptocurrency in any other currency that you need.
 *
 * @param {string} fsym The cryptocurrency symbol of interest [ Min length - 1] [ Max length - 30]
 * @param {string} tsyms Comma separated cryptocurrency symbols list to convert into [ Min length - 1] [ Max length - 500]
 * @returns {object}
 */
function priceSingle(fsym, tsyms) {
  return new Price(tsyms).singleSymbol(fsym)
}

/**
 *
 * @param {string} fsyms Comma separated cryptocurrency symbols list [ Min length - 1] [ Max length - 300]
 * @param {string} tsyms Comma separated cryptocurrency symbols list to convert into [ Min length - 1] [ Max length - 100]
 * @returns {object}
 */
function priceMulti(fsyms, tsyms) {
  return new Price(tsyms).multi(fsyms)
}

/**
 * Get all the current trading info (price, vol, open, high, low etc) of any list of cryptocurrencies in any other currency that you need.
 *
 * @param {string} fsyms Comma separated cryptocurrency symbols list [ Min length - 1] [ Max length - 1000]
 * @param {string} tsyms Comma separated cryptocurrency symbols list to convert into [ Min length - 1] [ Max length - 100]
 * @returns {object}
 */
function priceMultiFull(fsyms, tsyms) {
  return new Price(tsyms).multi(fsyms)
}

/**
 * Get the price of any cryptocurrency in any other currency that you need at a given timestamp.
 *
 * @param {string} fsym The cryptocurrency symbol of interest [ Min length - 1] [ Max length - 30]
 * @param {string} tsyms Comma separated cryptocurrency symbols list to convert into [ Min length - 1] [ Max length - 30]
 * @param {timestamp} ts The unix timestamp of interest
 * @returns {object}
 */
function priceHistoricalDay(fsym, tsyms, ts) {
  return new Price(tsyms).historicalDay(fsym, ts)
}

/**
 * Returns all the coins that CryptoCompare has added to the website.
 *
 * @returns {object} Return object {id:{key:value}}
 */
function infoCoinList() {
  return new Info().coinList()
}
