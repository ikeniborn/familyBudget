import { Methods } from './fetch'
export { Account }

/**
 * BSCScan instance
 */
class Instance {
  /**
   * Create new inctance API BSCScan
   */
  constructor(apikey) {
    this.methods = new Methods({
      domain: 'https://api.bscscan.com/api',
      query: { apikey },
      data: {
        muteHttpExceptions: true,
        header: 'accept: application/json',
      },
    })
  }
}

class Account extends Instance {
  constructor(apikey) {
    super(apikey)
    // this.methods = new Instance().methods
  }
  getBalance(address) {
    return this.methods.get({
      query: {
        module: 'account',
        action: 'balance',
        address,
      },
    })
  }
}
