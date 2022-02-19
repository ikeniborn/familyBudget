/**
 * Init api
 *
 * @param {string} app_id Your App ID
 */
function instance(app_id) {
  new Instance(app_id)
}

/**
 * Get a JSON list of all currency symbols available from the Open Exchange Rates API, along with their full names, for use in your integration.
 *
 * @returns {object}
 */
function getCurrencies() {
  return new Rates().currencies()
}

/**
 * Get the latest exchange rates available from the Open Exchange Rates API.
 *
 * @param {string} base Change base currency (3-letter code, default: USD)
 * @param {string} symbols Limit results to specific currencies (comma-separated list of 3-letter codes)
 * @returns {object}
 */
function getLatest(symbols, base) {
  return new Rates(base).latest(symbols)
}

/**
 * Returns exchange rate data for the currencies you have requested
 *
 * @param {string} base Change base currency (3-letter code, default: USD)
 * @param {string} date The requested date in YYYY-MM-DD format (required).
 * @param {string} symbols Limit results to specific currencies (comma-separated list of 3-letter codes)
 * @returns
 */
function getHistory(date, symbols, base) {
  return new Rates(base).history(date, symbols)
}
