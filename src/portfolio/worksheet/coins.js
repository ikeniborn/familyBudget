import { WorkSheet, WorkSheetRange } from '../../gas'
import { Portfolio } from '../spreadsheet/portfolio'
import { Header } from '../../header'
import { Hash } from '../../utils'
import * as cryptoRank from '../../restApi/cryptoRank'
import * as cryptoCompare from '../../restApi/cryptoCompare'
import * as coinMarketCap from '../../restApi/coinMarketCap'
import * as coinGecko from '../../restApi/coinGecko'
export { Coins }

class Coins {
  constructor() {
    this.head = new Portfolio().head.coins
    this.spreadSheetName = new Portfolio().spreadSheetName
    this.sheetName = 'Coins'
    this.workSheet = new WorkSheet(this.spreadSheetName, this.sheetName)
    this.values = this.workSheet.getDimension(this.head)
  }

  updateCoins() {
    const coins = []
    new coinGecko.CoinsList().getCoinsList().forEach((coin) => {
      const rowKey = new Hash('coingecko' + coin.name + coin.symbol).md5
      coins.push({
        rowKey: rowKey,
        source: 'coingecko',
        name: coin.name,
        symbol: coin.symbol,
        id: coin.id,
      })
    })
    // SpreadsheetApp.openById('1wTTuxXt8n9q7C4NDXqQpI3wpKu1_5bGVmP9Xz0XGSyU')
    //   .getSheetByName('CoinGecko Token API List')
    //   .getDataRange()
    //   .getValues()
    //   .slice(1)
    //   .forEach((coin) => {
    //     const key = new Hash('coingecko' + coin[2] + coin[1])
    //     coins.push({
    //       rowKey: key.md5,
    //       source: 'coingecko',
    //       name: coin[2],
    //       symbol: coin[1],
    //       id: coin[0],
    //     })
    //   })
    new cryptoRank.CoinsList().getCoinsList(15000).forEach((coin) => {
      const key = new Hash('cryptorank' + coin.name + coin.symbol)
      coins.push({
        rowKey: key.md5,
        source: 'cryptorank',
        name: coin.name,
        symbol: coin.symbol,
        id: coin.id,
      })
    })
    new coinMarketCap.CoinsList().getCoinsList().forEach((coin) => {
      const key = new Hash('coinmarketcap' + coin.name + coin.symbol)
      coins.push({
        rowKey: key.md5,
        source: 'coinmarketcap',
        name: coin.name,
        symbol: coin.symbol,
        id: coin.id,
      })
    })

    Object.entries(new cryptoCompare.CoinsList().getCoinsList()).forEach(
      (coin) => {
        const key = new Hash('cryptocompare' + coin[1].CoinName + coin[0])
        coins.push({
          rowKey: key.md5,
          source: 'cryptocompare',
          name: coin[1].CoinName,
          symbol: coin[1].Symbol,
          id: coin[0],
        })
      }
    )
    const currency = [
      ['USA dollar', 'USD'],
      ['Russian rubble', 'RUB'],
      ['Euro', 'EUR'],
    ]
    currency.forEach((coin) => {
      const key = new Hash('cryptocompare' + coin[0] + coin[1])
      coins.push({
        rowKey: key.md5,
        source: 'cryptocompare',
        name: coin[0],
        symbol: coin[1],
        id: coin[1],
      })
    })
    this.workSheet.insertRows(coins, this.head)
  }

  getOnEdit(range) {
    this.workSheetRange = new WorkSheetRange(
      this.spreadSheetName,
      this.sheetName,
      1,
      range
    )
    this.arrayOfObject = this.workSheetRange.getArrayOfObject(this.head)
    return this
  }

  updateInsert() {
    this.arrayOfObject.forEach((object) => {
      this.workSheet.updateRow(object, this.head, object.rowNum)
    })
  }
  updateOnEdit(range) {
    this.getOnEdit(range).updateInsert()
  }
}
