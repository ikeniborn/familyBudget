/**
 *
 * @param {string} api_key
 */
function instance(api_key) {
  new Instance(api_key)
}

/**
 * List of currencies with data
 *
 * @param {string} ids List of currency ids with comma separator. Example: ids=1,2,3
 * @param {string} convert Prices will show in this currency. Enum: "USD" "ETH" "BTC"
 * @returns {array}
 */
function currenciesLatest(ids, convert) {
  return new Currencies(convert).latest(ids)
}

/**
 * List of currencies with data
 *
 * @param {number} limit Limit count list return
 * @returns {array}
 */
function currenciesList(limit) {
  return new Currencies().list(limit)
}
