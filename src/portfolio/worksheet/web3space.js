import { Portfolio } from '../spreadsheet/portfolio'
export { Web3Space }
import * as coinMarketCap from '../../restApi/coinMarketCap'

class Web3Space {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet('Web3Space')
  }

  getCategory() {
    const coins = new Portfolio().getWorkSheet('coins').object
    const newArrayOfObject = this.workSheet.arrayOfObject.map((rowObject) => {
      const coinId = coins[rowObject.rowKey]?.id
      rowObject.category = coinId
        ? new coinMarketCap.Category().getCategory(coinId)
        : void 0
      return rowObject
    })
    this.workSheet.truncateInsertRows(newArrayOfObject)
    // console.log(newArrayOfObject)
  }
}
