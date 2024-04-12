import { Methods } from './fetch'
export { Account }

/**
 * BSCScan instance
 */
class Instance {
  /**
   * Create new inctance API BSCScan
   */
  constructor() {
    if (Instance.exists) {
      return Instance.instance
    }
    Instance.instance = this
    Instance.exists = true
    this.methods = new Methods({
      domain: 'https://api.bscscan.com/api',
      query: { '' },
      data: {
        muteHttpExceptions: true,
        header: 'accept: application/json',
      },
    })
  }
}

class Account  {
  constructor() {
    this.methods = new Instance().methods
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
