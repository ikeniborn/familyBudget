import { Methods } from './fetch'
export { Price, Dimension }
/**
 * CoinMarketCap instance
 */
class Instance {
  constructor() {
    if (Instance.exists) {
      return Instance.instance
    }
    Instance.instance = this
    Instance.exists = true
    this.methods = new Methods({
      domain: 'https://web-app-backend.w3s-crm.com/api/v1',
      data: {
        muteHttpExceptions: true,
        contentType: 'accept: application/json',
        headers: {
          'X-API-Key': 'w3s-api-ITVMIXoUJKUHKrte5kIz2TCzVOAZqNPzg1wE5s5VGs4r4Oiv47O5erPY',
        },
      },
    })
  }
}
/**
 * CoinMarketCap Price
 */
class Price {
  constructor() {
    this.methods = new Instance().methods
  }
  /**
   * Get last price
   *
   * @param {*} token_id
   * @returns {array}
   */
  getLastPrice(token_id = 'b460f578-b1ce-950c-287e-dc61d0728e51') {
    return this.methods.get({
      endPoint: '/token/latest',
      query: {
        token_id,
      },
    })?.data
  }
  /**
   * Get last price
   *
   * @param {*} token_id
   * @returns {array}
   */
  getLastPriceAll() {
    return this.methods.get({
      endPoint: '/token/latest',
    })?.data
  }
}

class Dimension {
  constructor() {
    this.methods = new Instance().methods
  }
  /**
   * Get last price
   *
   * @param {*} token_id
   * @returns {array}
   */
  getDimension(token_id = 'b460f578-b1ce-950c-287e-dc61d0728e51') {
    return this.methods.get({
      endPoint: '/token/dimension',
      query: {
        token_id,
      },
    })?.data
  }
}
