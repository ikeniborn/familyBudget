import { Portfolio } from '../spreadsheet/portfolio'
import { Hash, FormatDate, FormatNumber, FormatObject } from '../../utils'
import { Transactions } from './transactions'
export { Registry }

class Registry {
  constructor(workSheet = '') {
    this.workSheet = workSheet
      ? workSheet
      : new Portfolio().getWorkSheet(SpreadsheetApp.getActiveSheet().getName())
  }

  updateTransactions(isRange = false) {
    try {
      const transactions = new Transactions()
      const transactionsArrayOfObject = []
      const updateDate = new Date()
      this.workSheet.arrayOfObject.forEach((rowValues) => {
        let coinQty,
          currencyQty,
          currencyPerCoin,
          coinSymbol,
          symbolPrice,
          project,
          accountRecipient,
          recipient,
          currencySymbol,
          currencyPrice,
          feePrice,
          mainSymbol,
          isDelete,
          isLiquidityPool,
          isFee,
          isSenderLock,
          isRecipientLock,
          isAvgPrice,
          isSymbolPrice,
          isCurencyPrice,
          isFeePrice,
          isHistoricalAveragePrice,
          isHistoricalAveragePriceSymbol,
          isHistoricalAveragePriceFeeCurrency,
          isHistoricalAveragePriceCurrency,
          isLock,
          operationKey,
          transactionsRowOldSymbol,
          transactionsRowOldCurrency,
          transactionsRowOldFee,
          rowKey1,
          rowKey2,
          rowKey3,
          lockStatusKey

        const transactionRow = []
        const hhmm = new FormatNumber(
          rowValues.time
        ).getHourAndMinuteFromNumber()
        const dateTime = new FormatDate(rowValues.date).addTime(hhmm.h, hhmm.m)
          .date
        accountRecipient = rowValues.accountRecipient
          ? rowValues.accountRecipient
          : rowValues.accountSender
        recipient = rowValues.recipient ? rowValues.recipient : rowValues.sender
        project = rowValues.project ? rowValues.project : 'No project'
        coinQty = rowValues.coinQty || void 0
        currencyQty = rowValues.currencyQty || void 0
        currencyPerCoin = rowValues.currencyPerCoin || void 0
        coinSymbol = rowValues.coin
        currencySymbol = rowValues.currency
        isLiquidityPool = false
        isDelete = rowValues.isDelete || false
        operationKey = new Hash(rowValues.operation).md5
        lockStatusKey = new Hash(rowValues.lockStatus).md5
        isFee = false
        isAvgPrice = false
        isSenderLock = false
        isRecipientLock = false
        isSymbolPrice = false
        isCurencyPrice = false
        isFeePrice = false
        isLock = false
        isHistoricalAveragePriceSymbol = false
        isHistoricalAveragePriceFeeCurrency = false
        isHistoricalAveragePriceCurrency = false

        if (!currencyPerCoin && currencyQty) {
          currencyPerCoin = currencyQty / coinQty
        }
        if (!currencyQty && currencyPerCoin) {
          currencyQty = coinQty * currencyPerCoin
        }
        if (!coinQty) {
          coinQty = currencyQty / currencyPerCoin
        }
        //* расчет пулов ликвидности
        if (
          /*Liquidity pool (1), Liquidity pool (2)*/
          [
            'd70311b68290664f7a442bfa8266dbb9',
            '0dc48f5ee42e5f36afa288473e6e1799',
          ].indexOf(new Hash(rowValues.service).md5) !== -1
        ) {
          coinQty /= 2
          mainSymbol = coinSymbol
          isLiquidityPool = true
        }

        //* расчета статуса блокировки для перемещений
        if (lockStatusKey === 'dce7c4174ce9323904a934a486c41288' /*lock*/) {
          isSenderLock = false
          isRecipientLock = true
        } else if (
          lockStatusKey === '474f3c5e4e32cc95d291d859ae64ef7b' /*unlock*/
        ) {
          isSenderLock = true
          isRecipientLock = false
        } else {
          isSenderLock = false
          isRecipientLock = false
        }

        if (
          /*Transfer, Write-off, Refill*/
          [
            '84a0f3455dcca894ace136be62efa292',
            '7b33b9f52598cd60f7aa6ca0082515c4',
            'b4479040173a9f41eeb4e98339f2a21d',
          ].indexOf(operationKey) !== -1
        ) {
          currencyPerCoin = 1
          currencySymbol = coinSymbol

          if (
            /*Transfer, Write-off*/
            [
              '84a0f3455dcca894ace136be62efa292',
              '7b33b9f52598cd60f7aa6ca0082515c4',
            ].indexOf(operationKey) !== -1
          ) {
            rowKey1 = new Hash(rowValues.rowKey + '#1').md5
            transactionsRowOldCurrency = transactions.workSheet.object[rowKey1]
            transactionRow.push({
              rowKey: rowKey1,
              direction: 'out',
              account: rowValues.accountSender,
              contractor: rowValues.sender,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty * -1,
              isFee,
              isLock: isSenderLock,
              isLiquidityPool,
              isAvgPrice,
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
            })
          }
          if (
            /*Transfer, Refill*/
            [
              '84a0f3455dcca894ace136be62efa292',
              'b4479040173a9f41eeb4e98339f2a21d',
            ].indexOf(operationKey) !== -1
          ) {
            rowKey2 = new Hash(rowValues.rowKey + '#2').md5
            transactionsRowOldSymbol = transactions.workSheet.object[rowKey2]
            transactionRow.push({
              rowKey: rowKey2,
              direction: 'in',
              account: accountRecipient,
              contractor: recipient,
              project: 'No project',
              mainSymbol: void 0,
              symbol: coinSymbol,
              quantity: coinQty,
              isFee,
              isLock: isRecipientLock,
              isLiquidityPool,
              isAvgPrice,
              isSymbolPrice: true,
              isFeePrice,
              isCurencyPrice,
            })
          }
        } else if (
          /*buy*/
          ['0461ebd2b773878eac9f78a891912d65'].indexOf(operationKey) !== -1
        ) {
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5
          transactionsRowOldCurrency = transactions.workSheet.object[rowKey1]
          transactionRow.push({
            rowKey: rowKey1,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          })
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5
          transactionsRowOldSymbol = transactions.workSheet.object[rowKey2]
          transactionRow.push({
            rowKey: rowKey2,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            contractor: recipient,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice: true,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          })
        } else if (
          /*sell*/
          ['8325324b47e1e62a1c2998a640cbdc72'].indexOf(operationKey) !== -1
        ) {
          rowKey1 = new Hash(rowValues.rowKey + '#1').md5
          transactionsRowOldSymbol = transactions.workSheet.object[rowKey1]
          transactionRow.push({
            rowKey: rowKey1,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: project,
            mainSymbol: mainSymbol,
            symbol: coinSymbol,
            quantity: coinQty * -1,
            isFee,
            isLock: isSenderLock,
            isLiquidityPool,
            isAvgPrice: true,
            isSymbolPrice: true,
            isFeePrice,
            isCurencyPrice,
          })
          rowKey2 = new Hash(rowValues.rowKey + '#2').md5
          transactionsRowOldCurrency = transactions.workSheet.object[rowKey2]
          transactionRow.push({
            rowKey: rowKey2,
            direction: 'in',
            isLock: rowValues.isLock,
            account: accountRecipient,
            contractor: recipient,
            project: 'No project',
            mainSymbol: mainSymbol,
            symbol: currencySymbol,
            quantity: currencyQty,
            isFee,
            isLock: isRecipientLock,
            isLiquidityPool,
            isAvgPrice,
            isCurencyPrice: true,
            isFeePrice,
            isSymbolPrice,
          })
        }

        //* Комиссия
        if (rowValues.feeCurrency) {
          rowKey3 = new Hash(rowValues.rowKey + '#3').md5
          transactionsRowOldFee = transactions.workSheet.object[rowKey3]
          transactionRow.push({
            rowKey: rowKey3,
            direction: 'out',
            account: rowValues.accountSender,
            contractor: rowValues.sender,
            project: 'No project',
            mainSymbol: void 0,
            symbol: rowValues.feeCurrency,
            quantity: rowValues.feeQty * -1,
            isFee: true,
            isLock,
            isLiquidityPool,
            isAvgPrice,
            isFeePrice: true,
            isSymbolPrice,
            isCurencyPrice,
          })

          //* проверка изменения атрибутов влияющих на цену
          const isChangePrice = () => {
            return [9, 10, 11, 12, 13, 14, 15, 17, 18].some((column) => {
              return this.workSheet.columnNumArray.indexOf(column) !== -1
            })
          }
          if (isChangePrice()) {
            //* Расчет текущей или исторической цены комиссии токена
            const historicalPriceBuyFee = transactions.getHistoricalPriceBuy(
              dateTime,
              rowValues.accountSender,
              project,
              rowValues.feeCurrency,
              isRange
            )
            feePrice = historicalPriceBuyFee?.historicalPrice
            isHistoricalAveragePriceFeeCurrency =
              historicalPriceBuyFee?.isHistoricalAveragePrice || false

            //* Расчет текущей или исторической цены покупаемого токена
            const historicalPriceBuyCoin = transactions.getHistoricalPriceBuy(
              dateTime,
              rowValues.accountSender,
              project,
              currencySymbol,
              isRange
            )
            isHistoricalAveragePriceCurrency =
              historicalPriceBuyCoin?.isHistoricalAveragePrice || false
            currencyPrice = historicalPriceBuyCoin?.historicalPrice
            isHistoricalAveragePriceSymbol =
              historicalPriceBuyCoin?.isHistoricalAveragePrice || false
            symbolPrice = currencyPrice * currencyPerCoin
          }
        } else {
          isHistoricalAveragePriceFeeCurrency =
            transactionsRowOldFee?.isHistoricalAveragePrice
          isHistoricalAveragePriceCurrency =
            transactionsRowOldCurrency?.isHistoricalAveragePrice
          isHistoricalAveragePriceSymbol =
            transactionsRowOldSymbol?.isHistoricalAveragePrice
          feePrice = transactionsRowOldFee?.price
          currencyPrice = transactionsRowOldCurrency?.price
          symbolPrice = transactionsRowOldSymbol?.price
        }

        //* Формирование строки транзакции
        transactionRow.forEach((tx) => {
          let price
          if (tx.isSymbolPrice) {
            price = symbolPrice
            isHistoricalAveragePrice = isHistoricalAveragePriceSymbol || false
          } else if (tx.isFeePrice) {
            price = feePrice
            isHistoricalAveragePrice =
              isHistoricalAveragePriceFeeCurrency || false
          } else if (tx.isCurencyPrice) {
            price = currencyPrice
            isHistoricalAveragePrice = isHistoricalAveragePriceCurrency || false
          }
          const cost = tx.quantity * price
          const object = {
            rowKey: tx.rowKey,
            sourceKey: new Hash(this.workSheet.sheetName).md5,
            sourceName: new Hash(this.workSheet.sheetName).stringLowerCase,
            dateTime: dateTime,
            direction: tx.isFee ? 'out' : tx.direction.toLowerCase(),
            operation: tx.isFee
              ? 'write-off'
              : rowValues.operation.toLowerCase(),
            account: tx.account.toLowerCase(),
            platform: rowValues.platform.toLowerCase(),
            service: rowValues.service.toLowerCase(),
            project: tx.project.toLowerCase(),
            contractor: tx.contractor.toLowerCase(),
            mainSymbol: tx.mainSymbol ? tx.mainSymbol.toLowerCase() : void 0,
            symbol: tx.symbol.toLowerCase(),
            quantity: tx.quantity,
            price: price || 0,
            cost: cost || 0,
            comment: rowValues.comment.toString().toLowerCase(),
            registryRowNum: rowValues.rowNum,
            updateDate: updateDate,
            isDelete: isDelete,
            isAvgPrice: tx.isAvgPrice,
            isLiquidityPool: tx.isLiquidityPool,
            isFee: tx.isFee,
            isLock: tx.isLock,
            isHistoricalAveragePrice,
          }
          transactionsArrayOfObject.push(object)
        })
      })

      if (transactionsArrayOfObject.length) {
        transactions.updateTransactions(
          transactionsArrayOfObject,
          this.workSheet.isRange
        )
      }

      this.workSheet.deleteEmptyRows()
    } catch (error) {
      this.workSheet.log.addError('Registry.updateTransactions', error)
    }
  }
}
