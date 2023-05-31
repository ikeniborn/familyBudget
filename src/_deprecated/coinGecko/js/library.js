function ping() {
  return new Ping().ping()
}

/**
 * Get the current price of any cryptocurrencies in any other supported currencies that you need.
 *
 * @param {string} ids id of coins, comma-separated if querying more than 1 coin.
 * @param {string} vs_currencies vs_currency of coins, comma-separated if querying more than 1 vs_currency
 * @param {boolean} include_market_cap
 * @param {boolean} include_24hr_vol
 * @param {boolean} include_24hr_change
 * @param {boolean} include_last_updated_at
 * @returns
 */
function priceGet(
  ids,
  vs_currencies,
  include_market_cap,
  include_24hr_vol,
  include_24hr_change,
  include_last_updated_at
) {
  return new Price().get(
    ids,
    vs_currencies,
    include_market_cap,
    include_24hr_vol,
    include_24hr_change,
    include_last_updated_at
  )
}

/**
 * List all supported coins id, name and symbol (no pagination required)
 *
 * @param {boolean} include_platform flag to include platform contract addresses (eg. 0x.... for Ethereum based tokens).
 * @returns {object}
 */
function coinsList(include_platform) {
  return new Coins().list(include_platform)
}

/**
 * List all supported coins price, market cap, volume, and market related data
 *
 * @param {string} ids The ids of the coin, comma separated crytocurrency symbols (base). refers to /coins/list
 * @param {string} vs_currency The target currency of market data (usd, eur, jpy, etc.)
 * @param {string} price_change_percentage Include price change percentage in 1h, 24h, 7d, 14d, 30d, 200d, 1y (eg. '1h,24h,7d' comma-separated, invalid values will be discarded)
 * @returns {array}
 */
function coinsMarkets(ids, vs_currency, price_change_percentage) {
  return new Coins().markets(ids, vs_currency, price_change_percentage)
}
