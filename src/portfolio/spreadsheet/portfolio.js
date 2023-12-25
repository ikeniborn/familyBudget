import { Environment } from '../../gas'
import { Header } from '../../header'
import { FormatDate, Hash } from '../../utils'
import { WorkSheet, WorkSheetRange } from '../../gas'
import { Log } from '../../log'
export { Portfolio }

new Environment([
  {
    spreadSheetName: 'portfolio',
    sheetId: '1B6NX8DFLuVJu1yoWPVUsLMODApuTac7-S2anWQ63smg',
    scriptId: '1bDf1rR6-IIHpxh5nCuSErYmfokkWRuLbDJyqIA8qZtBgNY7OJttcaGey',
    area: 'prod',
  },
  {
    spreadSheetName: 'portfolio',
    sheetId: '1iGoWj5YHB_iQi7o09-vJF6XJeveFI54lLOlx193Y0f8',
    scriptId: '19LYhtfrshQkWLvGQedmXFG4XJkcOR3cO9-E6Ne32GmKT766phfg71J_d',
    area: 'dev',
  },
])

class Portfolio {
  constructor() {
    if (Portfolio.exists) {
      return Portfolio.instance
    }
    Portfolio.instance = this
    Portfolio.exists = true
    this.workSheetHeads = {
      registry: {
        type: 'tx',
        rowNum: 1,
        columns: {
          operation: { alias: 'Operation', idx: 0, notNull: true },
          portfolioSender: { alias: 'Portfolio (out)', idx: 1, notNull: true },
          accountRecipient: { alias: 'Account (in)', idx: 2 },
          portfolioRecipient: { alias: 'Portfolio (in)', idx: 3 },
          platform: { alias: 'Platform', idx: 4, notNull: true },
          service: { alias: 'Service', idx: 5, notNull: true },
          sender: { alias: 'Sender (out)', idx: 6, notNull: true },
          recipient: { alias: 'Recipient (in)', idx: 7 },
          lockStatus: { alias: 'Lock status', idx: 8 },
          coin: { alias: 'Coin', idx: 9, notNull: true },
          coinQty: { alias: 'Coin, qty', idx: 10 },
          currency: { alias: 'Currency', idx: 11 },
          currencyQty: { alias: 'Currency, qty', idx: 12 },
          currencyPerCoin: { alias: 'Currency per coin', idx: 13 },
          feeSender: { alias: 'Fee sender (out)', idx: 14 },
          feeCurrency: { alias: 'Fee currency', idx: 15 },
          feeQty: { alias: 'Fee, qty', idx: 16 },
          comment: { alias: 'Comment', idx: 17 },
          date: {
            alias: 'Date',
            idx: 18,
            notNull: true,
            type: 'date',
            default: void 0,
          },
          time: { alias: 'Time', idx: 19, notNull: true },
          isDelete: { alias: 'Is delete', idx: 20 },
          dateSaved: {
            alias: 'Date saved',
            idx: 21,
            type: 'date',
            default: new Date(),
          },
          timeSpent: {
            alias: 'Time spent (hh:mm:ss.ms)',
            idx: 22,
            type: 'string',
          },
          rowId: { alias: 'Row ID', idx: 23 },
        },
      },
      symbols: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: {
            alias: 'Source',
            idx: 1,
            notNull: true,
          },
          name: {
            alias: 'Name',
            idx: 2,
            notNull: true,
          },
          symbol: {
            alias: 'Symbol',
            idx: 3,
            pk: true,
            notNull: true,
          },
          symbolCategory: {
            alias: 'Symbol category ',
            idx: 4,
          },
          sourceId: { alias: 'Source id', idx: 5 ,},
          price: { alias: 'Price', idx: 6 },
          useInReport: { alias: 'Use in report', idx: 7 },
          update: {
            alias: 'Update',
            idx: 8,
            type: 'date',
            default: new Date(),
          },
        },
      },
      transactions: {
        type: 'fct',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          accountKey: { alias: 'Account key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          account: { alias: 'Account', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          portfolio: { alias: 'Portfolio', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          overflow: { alias: 'Overflow', idx: 11 },
          overflowRev: { alias: 'Overflow rev', idx: 12 },
          mainSymbol: { alias: 'Main coin', idx: 13 },
          symbol: { alias: 'Coin', idx: 14 },
          quantity: { alias: 'Quantity', idx: 15 },
          price: { alias: 'Price', idx: 16 },
          priceCoef: { alias: 'Price coef', idx: 17 },
          priceCoefRev: { alias: 'Price coef rev', idx: 18 },
          cost: { alias: 'Cost', idx: 19 },
          priceBTC: { alias: 'Price BTC', idx: 20 },
          costBTC: { alias: 'Cost BTC', idx: 21 },
          comment: { alias: 'Comment', idx: 22 },
          isDelete: { alias: 'Delete', idx: 23 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 24 },
          isFee: { alias: 'Is fee', idx: 25 },
          isLock: { alias: 'Is lock', idx: 26 },
          isAvgPrice: { alias: 'Is average price', idx: 27 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 28,
          },
          isOverflow: { alias: 'Is overflow', idx: 29 },
          registryRowId: { alias: 'Registry row id', idx: 30 },
          registryRowKey: { alias: 'Registry row key', idx: 301 },
          updateDate: {
            alias: 'Update date',
            idx: 32,
            type: 'date',
            default: new Date(),
          },
        },
      },
      deletedTransactions: {
        type: 'fct',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          accountKey: { alias: 'Account key', idx: 1 },
          historicalAveragePriceKey: {
            alias: 'Historical average price key',
            idx: 2,
          },
          account: { alias: 'Account', idx: 3 },
          dateTime: { alias: 'Date and time', idx: 4, type: 'date' },
          operation: { alias: 'Operation', idx: 5 },
          direction: { alias: 'Direction', idx: 6 },
          portfolio: { alias: 'Portfolio', idx: 7 },
          platform: { alias: 'Platform', idx: 8 },
          service: { alias: 'Service', idx: 9 },
          contractor: { alias: 'Contractor', idx: 10 },
          overflow: { alias: 'Overflow', idx: 11 },
          overflowRev: { alias: 'Overflow rev', idx: 12 },
          mainSymbol: { alias: 'Main coin', idx: 13 },
          symbol: { alias: 'Coin', idx: 14 },
          quantity: { alias: 'Quantity', idx: 15 },
          price: { alias: 'Price', idx: 16 },
          priceCoef: { alias: 'Price coef', idx: 17 },
          priceCoefRev: { alias: 'Price coef rev', idx: 18 },
          cost: { alias: 'Cost', idx: 19 },
          priceBTC: { alias: 'Price BTC', idx: 20 },
          costBTC: { alias: 'Cost BTC', idx: 21 },
          comment: { alias: 'Comment', idx: 22 },
          isDelete: { alias: 'Delete', idx: 23 },
          isLiquidityPool: { alias: 'Is liquidity pool', idx: 24 },
          isFee: { alias: 'Is fee', idx: 25 },
          isLock: { alias: 'Is lock', idx: 26 },
          isAvgPrice: { alias: 'Is average price', idx: 27 },
          isHistoricalAveragePrice: {
            alias: 'Is historical average price',
            idx: 28,
          },
          isOverflow: { alias: 'Is overflow', idx: 29 },
          registryRowId: { alias: 'Registry row id', idx: 30 },
          registryRowKey: { alias: 'Registry row key', idx: 301 },
          updateDate: {
            alias: 'Update date',
            idx: 32,
            type: 'date',
            default: new Date(),
          },
          deleteDate: {
            alias: 'Delete date',
            idx: 26,
            type: 'date',
            default: new Date(),
          },
        },
      },
      flow: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          portfolio: { alias: 'Portfolio', idx: 1 },
          contractor: { alias: 'Contractor', idx: 2 },
          contractorType: { alias: 'Contractor type', idx: 3 },
          contractorCategory: { alias: 'Contractor category', idx: 4 },
          symbol: { alias: 'Symbol name', idx: 5 },
          symbolFullName: { alias: 'Symbol full name', idx: 6 },
          symbolCategory: { alias: 'Symbol category', idx: 7 },
          // quantityBuy: { alias: 'Quantity (buy)', idx: 12 },
          // quantitySell: { alias: 'Quantity (sell)', idx: 13 },
          // quantityTransfer: { alias: 'Quantity (transfer)', idx: 12 },
          quantityInvest: { alias: 'Quantity (invest)', idx: 13 },
          quantityOverflow: { alias: 'Quantity (overflow)', idx: 13 },
          // quantityIn: { alias: 'Quantity (in)', idx: 12 },
          // quantityOut: { alias: 'Quantity (out)', idx: 13 },
          quantityRest: { alias: 'Quantity (rest)', idx: 12 },
          quantityLock: { alias: 'Quantity (lock)', idx: 13 },
          quantityRebalance: { alias: 'Quantity (rebalance)', idx: 43 },
          // quantityUnlock: { alias: 'Quantity (unlock)', idx: 14 },
          // priceIn: { alias: 'Price (in), $', idx: 19 },
          // priceOut: { alias: 'Price (out), $', idx: 19 },
          priceRest: { alias: 'Price (rest), $', idx: 19 },
          priceLast: { alias: 'Price (last), $', idx: 20 },
          // costBuyIn: { alias: 'Cost (buy in), $', idx: 24 },
          // costBuyOut: { alias: 'Cost (buy out), $', idx: 25 },
          // costRefillIn: { alias: 'Cost (refill in), $', idx: 33 },
          costTotal: { alias: 'Cost (total), $', idx: 22 },
          // costSellIn: { alias: 'Cost (sell in), $', idx: 26 },
          // costSellOut: { alias: 'Cost (sell out), $', idx: 27 },
          // costWriteOffOut: { alias: 'Cost (write-off out), $', idx: 34 },
          // costSell: { alias: 'Cost (sell), $', idx: 23 },
          // costTransferIn: { alias: 'Cost (transfer in), $', idx: 28 },
          // costTransferOut: { alias: 'Cost (transfer out), $', idx: 29 },
          // costTransfer: { alias: 'Cost (transfer), $', idx: 22 },
          // costOverflowIn: { alias: 'Cost (overflow in), $', idx: 30 },
          // costOverflowOut: { alias: 'Cost (overflow out), $', idx: 31 },
          costOverflow: { alias: 'Cost (overflow), $', idx: 32 },
          // costIn: { alias: 'Cost (in), $', idx: 21 },
          // costOut: { alias: 'Cost (out), $', idx: 21 },
          costInvest: { alias: 'Cost (invest), $', idx: 21 },
          costRest: { alias: 'Cost (rest), $', idx: 35 },
          costLast: { alias: 'Cost (last), $', idx: 36 },
          costLock: { alias: 'Cost (lock), $', idx: 37 },
          // costUnlock: { alias: 'Cost (unlock), $', idx: 38 },
          pnlRealized: { alias: 'PnL (realized), $', idx: 39 },
          pnlUnrealized: { alias: 'PnL (unrealized), $', idx: 40 },
          pnlTotal: { alias: 'PnL (total), $', idx: 40 },
          dayInPortfolioAvg: {
            alias: 'Average day in portfolio',
            idx: 44,
          },
          isSell: { alias: 'Is sell', idx: 45, default: false },
          useInReport: { alias: 'Use in report', idx: 46 },
          updateDate: {
            alias: 'Update date',
            idx: 47,
          },
          rowId: { alias: 'Row ID', idx: 48, default: 0 },
        },
      },
      flowBalance: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          symbolCategory: { alias: 'Symbol category', idx: 1 },
          cost: { alias: 'Cost, $', idx: 2 },
          updateDataMart: {
            alias: 'Update data mart',
            idx: 3,
            type: 'date',
          },
          updateDataMartKey: {
            alias: 'Update data mart key',
            idx: 4,
          },
          updateDate: {
            alias: 'Update date',
            idx: 5,
          },
          rowId: { alias: 'Row ID', idx: 6, default: 0 },
        },
      },
      overflows: {
        type: 'tx',
        rowNum: 1,
        columns: {
          account: { alias: 'Account', idx: 0 },
          dayInOverflowAvg: {
            alias: 'Day in overflow (avg)',
            idx: 1,
          },
          dayInBackFlowAvg: { alias: 'Day in backflow (avg)', idx: 2 },
          dayInFlowAvg: {
            alias: 'Day in flow (avg)',
            idx: 3,
          },
          overflow: { alias: 'Overflow', idx: 4 },
          backflow: { alias: 'Backflow', idx: 5 },
          ABPriceCoefFlow: { alias: 'A/B price coef overflow', idx: 6 },
          // ABPriceCoefRest: { alias: 'A/B price coef overflow (rest)', idx: 7 },
          ABPriceCoef: { alias: 'A/B price coef', idx: 7 },
          ABPriceCoefDiffPct: { alias: 'A/B price coef diff, %', idx: 8 },
          // ABPriceCoefRestDiffPct: { alias: 'A/B price coef diff (rest), %', idx: 10 },
          overflowStatus: { alias: 'Overflow status', idx: 9 },
          // overflowStatusRest: { alias: 'Overflow status (rest)', idx: 12 },
          tokenA: { alias: 'Token A', idx: 10 },
          tokenARestQuantity: { alias: 'Token A rest, qty', idx: 11 },
          tokenAOverFlowQuantity: { alias: 'Token A overflow, qty', idx: 12 },
          tokenABackFlowMaxPlanQuantity: {
            alias: 'Token A backflow max (plan), qty',
            idx: 13,
          },
          tokenABackFlowQuantity: {
            alias: 'Token A backflow, qty',
            idx: 14,
          },
          tokenAOverflowCostFreeze: {
            alias: 'Token A overflow cost freeze, $',
            idx: 15,
          },
          tokenAOverflowPnlQty: { alias: 'Token A overflow PnL, qty', idx: 16 },
          // tokenAOverflowPnlRestQty: { alias: 'Token A overflow PnL (rest), qty', idx: 20 },
          tokenAOverflowPnlQtyPct: {
            alias: 'Token A overflow PnL (qty), %',
            idx: 17,
          },
          // tokenAOverflowPnlRestQtyPct: {
          //   alias: 'Token A overflow PnL (rest) (qty), %',
          //   idx: 22,
          // },
          tokenB: { alias: 'Token B', idx: 18 },
          tokenBRestQuantity: { alias: 'Token B rest, qty', idx: 19 },
          tokenBOverFlowQuantity: { alias: 'Token B overflow, qty', idx: 20 },
          // tokenBBackFlowQuantity: { alias: 'Token B backflow, qty', idx: 21 },
          tokenBBackFlowMinPlanQuantity: {
            alias: 'Token B backflow min (plan), qty',
            idx: 22,
          },
          rowId: { alias: 'Row ID', idx: 23, default: 0 },
          updateDataMart: {
            alias: 'Update data mart',
            idx: 24,
            type: 'date',
          },
        },
      },
      coins: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          source: { alias: 'Source', pk: true, idx: 1, notNull: true },
          name: { alias: 'Name', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 3, notNull: true },
          id: { alias: 'Id', idx: 4 },
        },
      },
      sources: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      web3Space: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          source: { alias: 'Source', pk: true, idx: 1, notNull: true },
          name: { alias: 'Name', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'Symbol', pk: true, idx: 3, notNull: true },
          category: { alias: 'Category', idx: 4 },
        },
      },
      symbolCategory: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          nameRu: { alias: 'Name (ru)', idx: 2, notNull: true },
          share: { alias: 'Share, %', idx: 3 },
        },
      },
      proofType: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0, notNull: true },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          description: { alias: 'Description', idx: 1 },
        },
      },
      services: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          nameRu: { alias: 'Name (ru)', idx: 2 },
        },
      },
      operations: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      ecosystem: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          proofType: { alias: 'Proof type', idx: 2, notNull: true },
          share: { alias: 'Share, %', idx: 3 },
        },
      },
      portfolios: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      portfolioStrategies: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          account: { alias: 'Account', pk: true, idx: 1, notNull: true },
          portfolio: { alias: 'portfolio', pk: true, idx: 2, notNull: true },
          symbol: { alias: 'symbol', pk: true, idx: 3, notNull: true },
          share: { alias: 'Share, %', idx: 4 },
        },
      },
      accounts: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          telegramId: { alias: 'Telegram Id', idx: 3 },
        },
      },
      lockStatus: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
        },
      },
      contractors: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          name: { alias: 'Name', pk: true, idx: 1, notNull: true },
          type: { alias: 'Type', idx: 2, notNull: true },
          category: { alias: 'Category', idx: 3, notNull: true },
        },
      },
      lptoken: {
        type: 'dim',
        rowNum: 1,
        columns: {
          rowKey: { alias: 'Row key', idx: 0 },
          account: { alias: 'Account', pk: true, idx: 1, notNull: true },
          portfolio: { alias: 'Portfolio', pk: true, idx: 2, notNull: true },
          mainSymbol: { alias: 'Main symbol', pk: true, idx: 3, notNull: true },
          mainSymbolQty: {
            alias: 'Main symbol qty',
            idx: 4,
          },
          mainSymbolHistoricalCost: {
            alias: 'Main symbol historical cost',
            idx: 5,
          },
          mainSymbolHistoricalPrice: {
            alias: 'Main symbol historical price',
            idx: 6,
          },
          pairOneSymbol: { alias: 'Pair one symbol', idx: 7 },
          pairOneQty: { alias: 'Pair one qty', idx: 8 },
          pairOnePrice: { alias: 'Pair one price', idx: 9 },
          pairTwoSymbol: { alias: 'Pair one symbol', idx: 10 },
          pairTwoQty: { alias: 'Pair two qty', idx: 11 },
          pairTwoPrice: { alias: 'Pair two price', idx: 12 },
          pairThreeSymbol: { alias: 'Pair three symbol', idx: 13 },
          pairThreeQty: { alias: 'Pair three qty', idx: 14 },
          pairThreePrice: { alias: 'Pair three price', idx: 15 },
          update: {
            alias: 'Update',
            idx: 16,
            type: 'date',
            default: new Date(),
          },
        },
      },
    }
    this.spreadSheetName = 'portfolio'
    this.log = new Log(this.spreadSheetName)
  }

  getAccountsKey() {
    const head = new Header().getHead(this.workSheetHeads, 'Accounts')
    const workSheet = new WorkSheet(
      this.spreadSheetName,
      'Accounts',
      head
    ).getDataset()
    return workSheet.arrayOfObject.map((rowObject) => rowObject.rowKey)
  }

  getWorkSheet(sheetName) {
    try {
      let headSheetName, isRegistry
      headSheetName = sheetName
      isRegistry = false
      const accountsKey = this.getAccountsKey()
      if (accountsKey.indexOf(new Hash(sheetName).md5) !== -1) {
        headSheetName = 'Registry'
        isRegistry = true
      }
      const head = new Header().getHead(this.workSheetHeads, headSheetName)
      const workSheet = new WorkSheet(
        this.spreadSheetName,
        sheetName,
        head
      ).getDataset()
      workSheet.isRegistry = isRegistry
      workSheet.log = this.log
      return workSheet
    } catch (error) {
      console.error('Portfolio.getWorkSheet', error.stack)
    }
  }

  updateOnEdit(range) {
    try {
      let sheetName, headSheetName, isRegistry
      sheetName = range.getSheet().getSheetName()
      headSheetName = sheetName
      isRegistry = false
      const accountsKey = this.getAccountsKey()
      if (accountsKey.indexOf(new Hash(sheetName).md5) !== -1) {
        headSheetName = 'Registry'
        isRegistry = true
      }
      const head = new Header().getHead(this.workSheetHeads, headSheetName)
      const workSheet = new WorkSheetRange(
        this.spreadSheetName,
        sheetName,
        head,
        range
      ).getDataset()
      workSheet.isRegistry = isRegistry
      workSheet.log = this.log
      return workSheet
    } catch (error) {
      console.error('Portfolio.updateOnEdit', error.stack)
    }
  }
}

// Deprecated
// flowSymbol: {
//   type: 'tx',
//   rowNum: 1,
//   columns: {
//     account: { alias: 'Account', idx: 0 },
//     symbol: { alias: 'Symbol', idx: 1 },
//     symbolKey: { alias: 'Symbol key', idx: 2 },
//     quantityOwnInFlow: { alias: 'Quantity own in flow', idx: 3 },
//     quantityInFlow: { alias: 'Quantity in flow', idx: 4 },
//     quantityOutFlow: { alias: 'Quantity out flow', idx: 5 },
//     quantityRest: { alias: 'Quantity rest', idx: 6 },
//     quantityRestLock: { alias: 'Quantity rest lock', idx: 7 },
//     quantityRestUnlock: { alias: 'Quantity rest unlock', idx: 8 },
//     priceOwnInFlow: { alias: 'Price own in flow', idx: 9 },
//     priceInFlow: { alias: 'Price in flow', idx: 10 },
//     priceOutFlow: { alias: 'Price out flow', idx: 11 },
//     priceRest: { alias: 'Price rest', idx: 12 },
//     costOwnInFlow: { alias: 'Cost own in flow', idx: 13 },
//     costInFlow: { alias: 'Cost in flow', idx: 14 },
//     costOutFlow: { alias: 'Cost out flow', idx: 15 },
//     costRest: { alias: 'Cost rest', idx: 16 },
//     costRestInFlow: { alias: 'Cost rest in flow', idx: 17 },
//     costRestLock: { alias: 'Cost rest lock', idx: 18 },
//     costRestUnlock: { alias: 'Cost rest unlock', idx: 19 },
//     pnlTotal: { alias: 'PnL total', idx: 20 },
//     pnlRest: { alias: 'PnL rest', idx: 21 },
//     costPayback: { alias: 'Payback', idx: 22 },
//     dayInPortfolioAvg: {
//       alias: 'Day in Portfolio (avg)',
//       idx: 23,
//     },
//     update: {
//       alias: 'Update',
//       idx: 24,
//       type: 'date',
//       default: new Date(),
//     },
//   },
// },
