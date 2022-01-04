//TODO добавить валидацию пустых ячеек
//TODO в описание карточки добавлять возможный списко тэгов для МВз
//TODO добавить секундомер для оенки произодительности
/**
 * Преобразование времени из чиста в стороку
 * @param {number} t - число
 */
function timeToStr(t) {
  try {
    var ms = t % 1000
    t -= ms
    ms = Math.floor(ms / 10)
    t = Math.floor(t / 1000)
    var s = t % 60
    t -= s
    t = Math.floor(t / 60)
    var m = t % 60
    t -= m
    t = Math.floor(t / 60)
    var h = t % 60
    if (h < 10) h = '0' + h
    if (m < 10) m = '0' + m
    if (s < 10) s = '0' + s
    if (ms < 10) ms = '0' + ms
    return h + ':' + m + ':' + s + '.' + ms
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

/**
 * Преобразование времени из чиста в стороку
 * @param {date} start - дата начала
 */
function findTime(start) {
  try {
    const thisDate = new Date()
    const tdiff = thisDate.valueOf() - start.valueOf()
    return timeToStr(tdiff)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function addErrorItem(error) {
  try {
    const globalVariable = getGlobalVariable()
    const errorOpen = openGoogleSheet(globalVariable.sourceSheetID, globalVariable.sourceSheetNameError)
    errorOpen.appendRow([formatterDate().timestamp, '', '', error])
  } catch (e) {
    console.error(arguments.callee.name + ': ' + e)
  }
}

function formatterDate(date) {
  //* форматирование даты
  try {
    if (date == undefined) {
      date = new Date()
    }
    const formatter = {}
    formatter.date = Utilities.formatDate(new Date(date), 'GMT+3', 'dd.MM.yyyy')
    formatter.time = Utilities.formatDate(new Date(date), 'GMT+3', 'dd.MM.yyyy HH:mm')
    formatter.timestamp = Utilities.formatDate(new Date(date), 'GMT+3', 'dd.MM.yyyy HH:mm:ss')
    return formatter
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function objectToString(data) {
  try {
    const object = JSON.stringify(data)
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function addLog(postData) {
  try {
    if (isValidateAction(postData) && isUser(postData)) {
      const globalVariable = getGlobalVariable()
      const sourceOpen = openGoogleSheet(globalVariable.sourceSheetID, globalVariable.sourceSheetNameLog)
      const startDate = getPreviousDate(180)
      const sourceArray = getGoogleSheetValues(sourceOpen).reduce(function (row, array, index) {
        if (index != 0) {
          if (array[0] >= startDate) {
            row.push(array)
          }
        }
        return row
      }, [])
      const isNewAction = sourceArray.reduce(function (row, array) {
        if (isMatch(postData.action.id, array[2])) {
          row = false
        }
        return row
      }, true)
      if (isNewAction) {
        sourceOpen.appendRow([formatterDate().timestamp, postData.action.type, postData.action.id])
      }
      return isNewAction
    } else {
      return false
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function openGoogleSheet(sheetID, sheetName) {
  try {
    const object = SpreadsheetApp.openById(sheetID).getSheetByName(sheetName)
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getGoogleSheetValues(openSheet) {
  try {
    const object = openSheet.getDataRange().getValues()
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function isValidDate(d) {
  try {
    if (Object.prototype.toString.call(d) !== '[object Date]') {
      return false
    } else {
      return !isNaN(d.getTime())
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function isValidString(d) {
  try {
    if (Object.prototype.toString.call(d) == '[object String]') {
      return true
    } else {
      return false
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function isMatch(where, what) {
  try {
    if (isValidString(where) && isValidString(what)) {
      if (where.toLowerCase().replace(/\s+/g, '').trim().match(what.toLowerCase().replace(/\s+/g, '').trim())) {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getYMD(date) {
  try {
    if (!isValidDate(date)) {
      var date = new Date(date)
    }
    const object = {}
    object.y = new Date(date).getFullYear()
    object.m = new Date(date).getMonth() + 1
    object.d = new Date(date).getDate()
    object.ymd = object.y.toString() + object.m.toString() + object.d.toString()
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function copyObject(object) {
  try {
    if (Object.prototype.toString.call(object) == '[object Object]') {
      return Object.assign({}, object)
    } else {
      return {}
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getPreviousDate(n) {
  /*
   * n - количество дней
   */
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - n)
    return startDate
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function encodeData(data, symbol) {
  try {
    const encodeSymbol = encodeURIComponent(symbol)
    const encodeData = encodeURIComponent(data)
    if (isMatch(encodeData, encodeSymbol)) {
      return data.replace(symbol, encodeURIComponent(symbol))
    } else {
      return data
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function deleteLog(postObject) {
  try {
    const sourceOpen = postObject.logOpen
    const startDate = getPreviousDate(90)
    const deleteArrya = []
    getGoogleSheetValues(sourceOpen).reduce(function (row, array, index) {
      if (index > 0) {
        if (array[0] <= startDate) {
          deleteArrya.push(index + 1)
        }
      }
      return row
    }, [])
    if (deleteArrya.length > 0) {
      const startDeleteIndex = deleteArrya.reduce(function (a, b) {
        return a < b ? a : b
      })
      const countDeleteRow = deleteArrya.reduce(function (a, b) {
        return a > b ? a : b
      })
      sourceOpen.deleteRows(startDeleteIndex, countDeleteRow)
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function deleteError(postObject) {
  try {
    const errorOpen = postObject.errorOpen
    const startDate = getPreviousDate(1)
    const deleteArrya = []
    postObject.errorArray.reduce(function (row, array, index) {
      if (index != 0) {
        if (array[0] <= startDate) {
          deleteArrya.push(index + 1)
        }
      }
      return row
    }, [])
    if (deleteArrya.length > 0) {
      const startDeleteIndex = deleteArrya.reduce(function (a, b) {
        return a < b ? a : b
      })
      const countDeleteRow = deleteArrya.reduce(function (a, b) {
        return a > b ? a : b
      })
      errorOpen.deleteRows(startDeleteIndex, countDeleteRow)
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getPostObject(postData) {
  try {
    const object = Object.assign({}, getGlobalVariable())
    object.webHookDate = formatterDate().timestamp
    object.actionType = postData.action.type
    object.webHookActionId = postData.action.id
    //* открытие листов
    object.financialCenterSheetOpen = openGoogleSheet(object.sourceSheetID, object.financialCenterSheetName)
    object.accountingItemSheetOpen = openGoogleSheet(object.sourceSheetID, object.accountingItemSheetName)
    object.costСenterSheetOpen = openGoogleSheet(object.sourceSheetID, object.costСenterSheetName)
    object.parametrSheetOpen = openGoogleSheet(object.sourceSheetID, object.parametrSheetName)
    object.goalsSheetOpen = openGoogleSheet(object.sourceSheetID, object.goalsSheetName)
    object.trelloOpen = openGoogleSheet(object.sourceSheetID, object.sourceSheetNameTrello)
    object.errorOpen = openGoogleSheet(object.sourceSheetID, object.sourceSheetNameError)
    object.logOpen = openGoogleSheet(object.sourceSheetID, object.sourceSheetNameLog)
    object.targetOpen = openGoogleSheet(object.targetSheetID, object.targetSheetNameTarget)
    //* данные с листов
    object.financialСenterArray = getGoogleSheetValues(object.financialCenterSheetOpen)
    object.accountingItemArray = getGoogleSheetValues(object.accountingItemSheetOpen)
    object.costСenterArray = getGoogleSheetValues(object.costСenterSheetOpen)
    object.parametrArray = getGoogleSheetValues(object.parametrSheetOpen)
    object.goalsArray = getGoogleSheetValues(object.goalsSheetOpen)
    object.trelloArray = getGoogleSheetValues(object.trelloOpen)
    object.errorArray = getGoogleSheetValues(object.errorOpen)
    object.targetArray = getGoogleSheetValues(object.targetOpen)
    if (['updateComment', 'deleteComment'].indexOf(postData.action.type) !== -1) {
      object.actionId = postData.action.data.action.id
    } else {
      object.actionId = postData.action.id
    }
    object.actionDate = new Date(postData.action.date)
    object.memberId = postData.action.memberCreator.id
    object.memberUsername = postData.action.memberCreator.username
    object.boardId = postData.action.data.board.id
    object.boardName = postData.action.data.board.name
    if ([object.boardIdFact, object.boardIdFact0].indexOf(object.boardId) !== -1) {
      object.isFact = true
      if ([object.boardIdFact].indexOf(object.boardId) !== -1) {
        object.isCurrFact = true
      } else {
        object.isCurrFact = false
      }
      object.isBudget = false
      object.isCurrBudget = false
      object.isTarget = false
      object.type = 'Факт'
    } else if ([object.boardIdBudget, object.boardIdBudget2, object.boardIdBudget3].indexOf(object.boardId) !== -1) {
      object.isFact = false
      object.isCurrFact = false
      object.isBudget = true
      if ([object.boardIdBudget].indexOf(object.boardId) !== -1) {
        object.isCurrBudget = true
      } else {
        object.isCurrBudget = false
      }
      object.isTarget = false
      object.type = 'Бюджет'
    } else if ([object.boardIdTarget].indexOf(object.boardId) !== -1) {
      object.isFact = false
      object.isCurrFact = false
      object.isBudget = false
      object.isCurrBudget = false
      object.isTarget = true
      object.type = 'Факт'
    }
    if (['deleteComment', 'updateComment', 'commentCard', 'updateCard'].indexOf(postData.action.type) !== -1) {
      object.cardId = postData.action.data.card.id
      object.cardName = postData.action.data.card.name
      object.cardDescription = ''
      object.cardComment = ''
      object.cardLabelColor = getCardLabel(object).item.color
    }
    if (['commentCard', 'createList', 'updateCard', 'updateList'].indexOf(postData.action.type) !== -1) {
      object.listId = postData.action.data.list.id
      object.listName = postData.action.data.list.name
      if (['updateList'].indexOf(postData.action.type) !== -1) {
        object.listClosed = postData.action.data.list.closed
      }
      if (['updateCard'].indexOf(postData.action.type) !== -1) {
        object.cardClosed = postData.action.data.card.closed
      }
    } else if (['updateComment', 'deleteComment'].indexOf(postData.action.type) !== -1) {
      object.list = getCardList(object)
      object.listId = object.list.id
      object.listName = object.list.name
    }
    if (object.isTarget) {
      object.cfo = getTarget(object).item.cfo
    } else {
      object.cfo = getFinancialСenter(object).item.cfo
    }
    if (['Илья', 'Оксана'].indexOf(object.cfo) !== -1) {
      object.privateBudget = true
    } else {
      object.privateBudget = false
    }
    if (['deleteComment', 'updateComment', 'commentCard', 'updateCard'].indexOf(postData.action.type) !== -1) {
      object.accountingItem = getAccountingItem(object)
      object.cashFlow = object.accountingItem.item.cashFlow
      object.bill = object.accountingItem.item.bill
      object.account = object.accountingItem.item.account
      object.nomenclature = postData.action.data.card.name
      if (['updateComment', 'commentCard'].indexOf(postData.action.type) !== -1) {
        if (['updateComment'].indexOf(postData.action.type) !== -1) {
          object.text = postData.action.data.action.text
        } else {
          object.text = postData.action.data.text
        }
        object.parseText = parseComment(object)
        object.sum = object.parseText.sum
        if (['updateComment'].indexOf(postData.action.type) !== -1) {
          const objectOld = copyObject(object)
          objectOld.text = postData.action.data.old.text
          object.oldSum = parseComment(objectOld).sum
        }
        object.comment = object.parseText.comment
        if (object.isTarget) {
          object.mvz = getTarget(object).item.goal
        } else {
          object.mvz = getCostСenter(object).item.mvz
        }
      }
    }
    if (['createList', 'updateList'].indexOf(postData.action.type) !== -1) {
      const currDate = new Date()
      object.period = new Date(currDate.getFullYear(), currDate.getMonth(), 1)
      object.ymd = getYMD(object.period)
      object.factPeriod2 = new Date(object.period.getFullYear(), object.period.getMonth() - 2, 1)
      object.factPeriod1 = new Date(object.period.getFullYear(), object.period.getMonth() - 1, 1)
      object.factPeriod = object.period
      object.budgetPeriodCurrent = object.period
      object.budgetPeriod = new Date(object.period.getFullYear(), object.period.getMonth() + 1, 1)
      object.budgetPeriod2 = new Date(object.period.getFullYear(), object.period.getMonth() + 2, 1)
      object.budgetPeriod3 = new Date(object.period.getFullYear(), object.period.getMonth() + 3, 1)
    } else {
      object.date = getPeriod(object)
      object.period = object.date.period
      object.ymd = object.date.ymd
      object.factPeriod2 = object.date.factPeriod2
      object.factPeriod1 = object.date.factPeriod1
      object.factPeriod = object.date.factPeriod
      object.budgetPeriodCurrent = object.date.budgetPeriodCurrent
      object.budgetPeriod = object.date.budgetPeriod
      object.budgetPeriod2 = object.date.budgetPeriod2
      object.budgetPeriod3 = object.date.budgetPeriod3
    }
    if (['deleteComment', 'updateComment', 'commentCard'].indexOf(postData.action.type) !== -1) {
      object.dataTrello = getAllDataTrello(object)
    }
    if (['deleteComment', 'updateComment'].indexOf(postData.action.type) !== -1) {
      object.isOldData = isOldData(object)
    } else {
      object.isOldData = false
    }
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

// обновление параметра
function addFinancialCenter(postObject) {
  /*
   * @postObject - входные параметра запроса
   * */
  try {
    var ss = postObject.financialCenterSheetOpen
    var ssParametr = postObject.parametrSheetOpen
    var array = getFinancialСenter(postObject).array
    var arrayPаrametr = getParametr(postObject).array
    var cfoArray = array.map(function (array) {
      return array.id
    })
    var parametrArray = arrayPаrametr.map(function (array) {
      return array.id
    })
    if (postObject.cfo == undefined) {
      var newId = cfoArray.length + 1
      ss.appendRow([newId, postObject.listName, formatterDate().timestamp])
      postObject.financialСenterArray = getGoogleSheetValues(postObject.financialCenterSheetOpen)
      var newIdParametr = parametrArray.length + 1
      ssParametr.appendRow([newIdParametr, 'Факт', postObject.listName, postObject.factPeriod, formatterDate().timestamp])
      ssParametr.appendRow([newIdParametr + 1, 'Бюджет', postObject.listName, postObject.budgetPeriod, formatterDate().timestamp])
    }
    //* обновление листа
    postObject.listName = postObject.listName + ' ' + formatterDate(postObject.period).date
    updateList(postObject)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

// обновление параметра
function addTarget(postObject) {
  /*
   * @postObject - входные параметра запроса
   * */
  try {
    const ss = postObject.goalsSheetOpen
    const array = getTarget(postObject).array
    const goal = getTarget(postObject).item.goal
    const cfo = getFinancialСenter(postObject).item.cfo
    const objGoal = postObject.listName.toLowerCase().replace(cfo.toLowerCase(), '').trim()
    const newGoal = objGoal[0].toUpperCase() + objGoal.slice(1)
    const goalArray = array.map(function (array) {
      return array.name
    })
    const ssMvz = postObject.costСenterSheetOpen
    const postObjectCopy = copyObject(postObject)
    postObjectCopy.comment = objGoal
    postObjectCopy.cfo = cfo
    const arrayMvz = getCostСenter(postObjectCopy).array
    const tagMvz = objGoal.toLowerCase().replace(/\s+/g, '').trim()
    const newIdMvz = arrayMvz.length + 1
    if (goal == undefined) {
      const newId = goalArray.length + 1
      ss.appendRow([newId, postObject.listName, newGoal, cfo, formatterDate().timestamp, postObject.listId, 'actual'])
      ssMvz.appendRow([newIdMvz, objGoal, tagMvz])
      postObject.goalsArray = getGoogleSheetValues(postObject.goalsSheetOpen)
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function closedBudgetPeriod(postObject) {
  try {
    const postObjectBudget = copyObject(postObject)
    postObjectBudget.boardId = postObjectBudget.boardIdBudget
    postObjectBudget.listId = getList(postObjectBudget).id
    postObjectBudget.listName = postObjectBudget.cfo + ' ' + formatterDate(postObjectBudget.budgetPeriod).date
    archiveAllCards(postObjectBudget)
    updateList(postObjectBudget)
    const postObjectBudget2 = copyObject(postObjectBudget)
    postObjectBudget2.boardId = postObjectBudget2.boardIdBudget2
    postObjectBudget2.listId = getList(postObjectBudget2).id
    postObjectBudget2.listName = postObjectBudget2.cfo + ' ' + formatterDate(postObjectBudget2.budgetPeriod2).date
    moveAllCards(postObjectBudget2, postObjectBudget)
    updateList(postObjectBudget2)
    const postObjectBudget3 = copyObject(postObjectBudget2)
    postObjectBudget3.boardId = postObjectBudget3.boardIdBudget3
    postObjectBudget3.listId = getList(postObjectBudget3).id
    postObjectBudget3.listName = postObjectBudget3.cfo + ' ' + formatterDate(postObjectBudget3.budgetPeriod3).date
    moveAllCards(postObjectBudget3, postObjectBudget2)
    createCardsForList(postObjectBudget3)
    updateList(postObjectBudget3)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function closedFactPeriod(postObject) {
  try {
    const postObjectFact0 = copyObject(postObject)
    postObjectFact0.boardId = postObjectFact0.boardIdFact0
    postObjectFact0.listId = getList(postObjectFact0).id
    postObjectFact0.listName = postObjectFact0.cfo + ' ' + formatterDate(postObjectFact0.factPeriod1).date
    if (postObjectFact0.listId == undefined) {
      postObjectFact0.listId = addList(postObjectFact0).id
    } else {
      //* закрытие листа на доске факт-1
      archiveAllCards(postObjectFact0)
      updateList(postObjectFact0)
    }
    //* Перенос карточек на доску факт-1
    moveAllCards(postObject, postObjectFact0)
    //* обновление текущего листа факта
    postObject.listName = postObject.cfo + ' ' + formatterDate(postObject.factPeriod).date
    updateList(postObject)
    //* создание карточек на листе факт
    createCardsForList(postObject)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function createCardsForList(postObject) {
  try {
    const accountArray = getAccountingItem(postObject).array
    let accountItems
    if (postObject.isFact) {
      accountItems = accountArray.filter(function (row) {
        return row.fact == 1
      })
    } else if (postObject.isBudget) {
      accountItems = accountArray.filter(function (row) {
        return row.budget == 1
      })
    } else if (postObject.isTarget) {
      accountItems = accountArray.filter(function (row) {
        return row.target == 1
      })
    }
    //* Информация по меткам
    const labelList = getBoardLabel(postObject, postObject.boardId)
    //* создание карточек на листе факт
    accountItems.forEach(function (accounts) {
      const label = labelList.reduce(function (row, arrya) {
        if (isMatch(accounts.color, arrya.color)) {
          row = arrya
        }
        return row
      }, {})
      addCard(postObject, accounts.nomenclature, postObject.listId, accounts.id, label.id).id
    })
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function deleteEmptyRow(postObject) {
  try {
    const ss = postObject.trelloOpen
    const ssMaxRows = ss.getMaxRows()
    const ssLastRow = ss.getLastRow()
    if (ssMaxRows - ssLastRow !== 0) {
      ss.deleteRows(ssLastRow + 1, ssMaxRows - ssLastRow)
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function deleteRowByActionId(postObject) {
  try {
    //* удаление данных на листе источнике
    const ss = postObject.trelloOpen
    const sourceData = postObject.trelloArray
    const sum = sourceData.reduce(function (row, array) {
      if (isMatch(postObject.actionId, array[10])) {
        //? добавить массив: сумма, мвз
        row = array[8]
      }
      return row
    }, {})
    const sourceRows = sourceData.reduce(function (row, array, index) {
      if (isMatch(postObject.actionId, array[10])) {
        row.push(index + 1)
      }
      row.sort(function (a, b) {
        return b - a
      })
      return row
    }, [])
    sourceRows.forEach(function (row) {
      ss.deleteRow(row)
      //* удаление данных в массиве учета
      sourceData.splice(row - 1, 1)
    })
    postObject.dataTrello = getAllDataTrello(postObject)
    return sum
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getAccountingItem(postObject) {
  //* получаение справочника статей
  try {
    const array = postObject.accountingItemArray
    if (postObject.cardName == undefined) {
      postObject.cardName = ''
      postObject.cardLabelColor = ''
    }
    const object = {}
    object.array = array.reduce(function (row, array, index) {
      if (index != 0) {
        const object = {}
        object.id = array[0]
        object.cashFlow = array[1]
        object.bill = array[2]
        object.account = array[3]
        object.nomenclature = array[4]
        object.budget = array[5]
        object.fact = array[6]
        object.target = array[7]
        object.color = array[8]
        row.push(object)
      }
      return row
    }, [])
    object.item = object.array.reduce(function (row, array) {
      if (isMatch(postObject.cardName, array.nomenclature) && isMatch(postObject.cardLabelColor, array.color)) {
        row = array
      }
      return row
    }, {})
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getAllTarget(postObject) {
  try {
    const array = postObject.targetArray
    const target = getTarget(postObject).item
    const object = {}
    object.array = array.reduce(function (row, array, index) {
      if (index != 0) {
        const object = {}
        object.timestamp = array[0]
        object.goal = array[1]
        object.cfo = array[2]
        object.startDate = new Date(array[3])
        object.duration = +array[4]
        object.cost = +array[5]
        object.inflation = +array[6]
        object.endDate = new Date(array[7])
        object.complete = array[8]
        object.budget = +array[9]
        object.newCost = +array[10]
        object.monthDeductionSum = +array[11]
        object.currentListedSum = +array[12]
        object.targetSum = +array[14]
        object.depositSum = +array[15]
        object.exchangeSum = +array[16]
        object.iisSum = +array[17]
        object.disbursedFunds = +array[18]
        object.inStock = +array[19]
        object.completePersent = +array[20]
        object.indexRow = index + 1
        row.push(object)
      }
      return row
    }, [])
    object.item = object.array.reduce(function (row, array) {
      if (isMatch(target.goal, array.goal) && isMatch(target.cfo, array.cfo)) {
        row = array
      }
      return row
    }, {})
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

/* eslint-disable no-undef */
function getComment(postObject) {
  try {
    const comment = {}
    const sum = getSum(postObject)
    if (isMatch(postObject.actionType, 'commentCard')) {
      comment.text = '**Внесенная сумма**: ' + postObject.sum + ' р.' + postObject.lineBreak
      comment.message = '<b><u>' + postObject.cfo + '</u> внесено</b>: ' + postObject.sum + ' р.' + postObject.telegramLineBreak
    } else if (isMatch(postObject.actionType, 'updateComment')) {
      comment.text = '**Новая сумма**: ' + postObject.sum + ' р.' + postObject.lineBreak
      comment.message = '<b><u>' + postObject.cfo + '</u> изменено</b>: ' + postObject.sum + ' р.' + postObject.telegramLineBreak
      comment.message += '<i>Новое</i> - ' + postObject.sum + ' р.' + postObject.telegramLineBreak
      comment.message += '<i>Старое</i> - ' + postObject.oldSum + ' р.' + postObject.telegramLineBreak
    } else if (isMatch(postObject.actionType, 'deleteComment')) {
      comment.text = '**Удаленная сумма**: ' + postObject.sum + ' р.' + postObject.lineBreak
      comment.message = '<b><u>' + postObject.cfo + '</u> удалено</b>: ' + postObject.sum + ' р.' + postObject.telegramLineBreak
    }
    if (postObject.isFact) {
      //* комментарий по факту
      comment.text += '**Остаток средств** ' + '*' + postObject.cfo + '*: ' + sum.totalSum.totalRest + ' р.' + postObject.lineBreak
      comment.text += '**Остаток бюджета**:' + postObject.lineBreak
      comment.text += '*Статья* - ' + postObject.account + ': ' + sum.totalSum.accountBudgetRest + ' р.' + postObject.lineBreak
      comment.text += '*Номенклатура* - ' + postObject.nomenclature + ': ' + sum.totalSum.nomenclatureBudgetRest + ' р.' + postObject.lineBreak
      comment.message += '<i>МВЗ</i> - ' + postObject.mvz + postObject.telegramLineBreak
      comment.message += '<b>Ост. ДС</b>: ' + sum.totalSum.totalRest + ' р.' + postObject.telegramLineBreak
      comment.message += '<b>Ост. бюджета</b>:' + postObject.telegramLineBreak
      comment.message += '<i>' + postObject.account + '</i>: ' + sum.totalSum.nomenclatureBudgetRest + ' р.' + postObject.telegramLineBreak
      comment.message += '<i>' + postObject.nomenclature + '</i>: ' + sum.totalSum.accountBudgetRest + ' р.' + postObject.telegramLineBreak
      if (isValidString(postObject.comment)) {
        comment.text += '**Комментарий**: ' + postObject.comment
        comment.message += '<b>Комментарий</b>: ' + postObject.comment
      }
    } else if (postObject.isBudget) {
      //* комментарий по бюджету
      comment.text += '**Бюджет**:' + postObject.lineBreak
      comment.text += '*Номенклатура* - ' + postObject.nomenclature + ': ' + sum.budgetSum.nomenclatureSum + ' р.' + postObject.lineBreak
      comment.text += '*Статья* - ' + postObject.account + ': ' + sum.budgetSum.accountSum + ' р.' + postObject.lineBreak
      comment.text += '*Счет* - ' + postObject.bill + ': ' + sum.budgetSum.billSum + ' р.' + postObject.lineBreak
      comment.message += '<i>МВЗ</i> - ' + postObject.mvz + postObject.telegramLineBreak
      comment.message += '<b>Бюджет</b>:' + postObject.telegramLineBreak
      comment.message += '<i>Номенклатура</i> - ' + postObject.nomenclature + ': ' + sum.budgetSum.nomenclatureSum + ' р.' + postObject.telegramLineBreak
      comment.message += '<i>Статья</i> - ' + postObject.account + ': ' + sum.budgetSum.accountSum + ' р.' + postObject.telegramLineBreak
      if (isValidString(postObject.comment)) {
        comment.text += '**Комментарий**: ' + postObject.comment
        comment.message += '<b>Комментарий</b>: ' + postObject.comment
      }
    } else if (postObject.isTarget) {
      //* комментарий по цели
      comment.text += '*Счет* - ' + postObject.nomenclature + postObject.lineBreak
      comment.text += '*Старая сумма*: ' + postObject.targetSumOld + ' р.' + postObject.lineBreak
      comment.text += '*Новая сумма*: ' + postObject.targetSumNew + ' р.' + postObject.lineBreak
      comment.text += '*Изменения*: ' + postObject.actionSum + ' р.'
      comment.message += '<i>МВЗ</i> - ' + postObject.mvz + postObject.telegramLineBreak
      comment.message += '<i>Счет</i> - ' + postObject.nomenclature + postObject.telegramLineBreak
      comment.message += '<i>Старая сумма</i>: ' + postObject.targetSumOld + ' р.' + postObject.telegramLineBreak
      comment.message += '<i>Новая сумма</i>: ' + postObject.targetSumNew + ' р.' + postObject.telegramLineBreak
      comment.message += '<i>Изменения</i>: ' + postObject.actionSum + ' р.'
    }
    return comment
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getCostСenter(postObject) {
  try {
    const array = postObject.costСenterArray
    const object = {}
    object.array = array.reduce(function (row, array, index) {
      if (index != 0) {
        const object = {}
        object.id = array[0]
        object.mvz = array[1]
        object.tag = array[2]
        row.push(object)
      }
      return row
    }, [])
    object.item = object.array.reduce(function (row, array) {
      if (isMatch(postObject.comment, array.tag)) {
        row = array
      }
      return row
    }, {
      id: 0,
      mvz: postObject.cfo,
      tag: postObject.cfo
    })
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getDescription(postObject) {
  try {
    const description = {}
    const sum = getSum(postObject)
    description.text = '*Дата обновления*: ' + formatterDate(postObject.actionDate).time + postObject.lineBreak
    if (postObject.isFact || postObject.isBudget) {
      if (postObject.isFact) {
        //* описание для фактических карточек
        description.text += '**По номенклатуре**: ' + postObject.lineBreak
        description.text += '*Остаток*: ' + sum.totalSum.nomenclatureBudgetRest + ' р.' + postObject.lineBreak
        if (sum.totalSum.nomenclatureBudgetExecution != 0) {
          description.text += '*Исполнение*: ' + sum.totalSum.nomenclatureBudgetExecution + encodeData('%', '%') + postObject.lineBreak
        }
        description.text += '**По статье**: ' + postObject.lineBreak
        description.text += '*Остаток*: ' + sum.totalSum.accountBudgetRest + ' р.' + postObject.lineBreak
        if (sum.totalSum.accountBudgetExecution != 0) {
          description.text += '*Исполнение*: ' + sum.totalSum.accountBudgetExecution + encodeData('%', '%') + postObject.lineBreak
        }
      } else if (postObject.isBudget) {
        if (!isMatch(postObject.nomenclature, 'Баланс')) {
          //* описание для бюджетных карточек
          description.text += '**Итого бюджет на** *' + formatterDate(postObject.period).date + '*:' + postObject.lineBreak
          description.text += '*По операции*: ' + sum.budgetSum.cashFlowSum + ' р.' + postObject.lineBreak
          description.text += '*По счету*: ' + sum.budgetSum.billSum + ' р.' + postObject.lineBreak
          description.text += '*По статье*: ' + sum.budgetSum.accountSum + ' р.' + postObject.lineBreak
          description.text += '*По номенклатуре*: ' + sum.budgetSum.nomenclatureSum + ' р.' + postObject.lineBreak
          if (postObject.isCurrBudget) {
            //* информация в рестроспективе за последние два месяца
            description.text += '**Факт прошлых периодов:**' + postObject.lineBreak
            const previousFact = getPreviousFact(postObject)
            description.text += formatterDate(postObject.factPeriod).date + ': ' + previousFact.Prev0.factSum.nomenclatureSum + ' р.' + postObject.lineBreak
            description.text += formatterDate(postObject.factPeriod1).date + ': ' + previousFact.Prev1.factSum.nomenclatureSum + ' р.' + postObject.lineBreak
          }
        } else if (isMatch(postObject.nomenclature, 'Баланс')) {
          //* описание карточки баланса
          description.text += '**Итоговый бюджет** *' + formatterDate(postObject.period).date + '* **по статьям**' + ':' + postObject.lineBreak
          if (sum.budgetSum.groupAccount.length !== 0) {
            const groupBudgetRows = sum.budgetSum.groupAccount
            groupBudgetRows.forEach(function (row) {
              description.text += row.bill + ' - ' + row.account + ': ' + row.sum + ' р. ' + postObject.lineBreak
            })
          }
          description.text += '**Остатки**: ' + sum.factSum.restSum + ' р.' + postObject.lineBreak
          description.text += '**Операционный бюджет**: ' + sum.budgetSum.costSum + ' р.' + postObject.lineBreak
          description.text += '**Бюджет отчислений**: ' + sum.budgetSum.accumulationBillExpenseSum + ' р.' + postObject.lineBreak
          //* информация по переводам
          if (postObject.privateBudget) {
            description.text += '**Перечисления**: ' + postObject.lineBreak
            description.text += '*Первый перевод на счет Семьи*: ' + sum.totalSum.firstTransferToFamilyAccount + postObject.lineBreak
            description.text += '*Перечислить в накопления*: ' + sum.budgetSum.accumulationNomenclatureExpenseSum + postObject.lineBreak
            description.text += '*Снять с накоплений*: ' + sum.budgetSum.accumulationNomenclatureIncomeSum
          }
        }
      }
      //* данные по бюджетным заявкам
      if (sum.budgetSum.nomenclatureRows.length != 0 && !isMatch(postObject.nomenclature, 'Баланс')) {
        const budgetRow = sum.budgetSum.nomenclatureRows
        description.text += '**Бюджетные заявки**:' + postObject.lineBreak
        let i = 1
        budgetRow.forEach(function (row) {
          let comma
          budgetRow.length > i ? comma = postObject.lineBreak : comma = ''
          description.text += formatterDate(row.actionDate).time + ': ' + row.sum + ' р. ' + row.comment + comma
          i += 1
        })
      }
      description.haveBudget = sum.totalSum.haveBudget
    } else if (postObject.isTarget) {
      if (isMatch(postObject.nomenclature, 'Баланс')) {
        const targetItem = getAllTarget(postObject).item
        description.text += 'Перечислено в т.м.: ' + targetItem.currentListedSum + ' р. ' + postObject.lineBreak
        description.text += 'Цели: ' + targetItem.targetSum + ' р. ' + postObject.lineBreak
        description.text += 'Депозит: ' + targetItem.depositSum + ' р. ' + postObject.lineBreak
        description.text += 'Биржа: ' + targetItem.exchangeSum + ' р. ' + postObject.lineBreak
        description.text += 'ИИС: ' + targetItem.iisSum + ' р. ' + postObject.lineBreak
        description.text += 'Освоено: ' + targetItem.disbursedFunds + ' р. ' + postObject.lineBreak
        description.text += 'В наличии: ' + targetItem.inStock + ' р. ' + postObject.lineBreak
        description.text += 'Выполнено: ' + (targetItem.completePersent * 100).toFixed(2) + encodeData('%', '%')
      }
    }
    return description
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getFinancialСenter(postObject) {
  try {
    const array = postObject.financialСenterArray
    const object = {}
    object.array = array.reduce(function (row, array, index) {
      if (index != 0) {
        const object = {}
        object.id = array[0]
        object.cfo = array[1]
        row.push(object)
      }
      return row
    }, [])
    object.item = object.array.reduce(function (row, array) {
      if (isMatch(postObject.listName, array.cfo)) {
        row = array
      }
      return row
    }, {})
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getParametr(postObject) {
  try {
    const array = postObject.parametrArray
    const object = {}
    object.array = array.reduce(function (row, array, index) {
      if (index != 0) {
        const object = {}
        object.id = array[0]
        object.type = array[1]
        object.cfo = array[2]
        object.value = new Date(array[3])
        object.indexRow = index + 1
        row.push(object)
      }
      return row
    }, [])
    object.item = object.array.reduce(function (row, array) {
      if (isMatch(postObject.cfo, array.cfo) && isMatch(postObject.type, array.type)) {
        row = array
      }
      return row
    }, {})
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getPeriod(postObject) {
  try {
    const date = {}
    if (postObject.isFact || postObject.isTarget) {
      const postObjectCopy = copyObject(postObject)
      postObjectCopy.type = 'Бюджет'
      date.factPeriod = getParametr(postObject).item.value
      date.budgetPeriod = getParametr(postObjectCopy).item.value
      date.factPeriod1 = new Date(date.factPeriod.getFullYear(), date.factPeriod.getMonth() - 1, 1)
      date.factPeriod2 = new Date(date.factPeriod.getFullYear(), date.factPeriod.getMonth() - 2, 1)
      date.budgetPeriod2 = new Date(date.budgetPeriod.getFullYear(), date.budgetPeriod.getMonth() + 1, 1)
      date.budgetPeriod3 = new Date(date.budgetPeriod.getFullYear(), date.budgetPeriod.getMonth() + 2, 1)
      if (getYMD(date.factPeriod).ymd === getYMD(date.budgetPeriod).ymd) {
        date.budgetPeriodCurrent = date.budgetPeriod
      } else {
        date.budgetPeriodCurrent = date.factPeriod
      }
    } else if (postObject.isBudget) {
      const postObjectCopy = copyObject(postObject)
      postObjectCopy.type = 'Факт'
      date.factPeriod = getParametr(postObjectCopy).item.value
      date.budgetPeriod = getParametr(postObject).item.value
      date.factPeriod1 = new Date(date.factPeriod.getFullYear(), date.factPeriod.getMonth() - 1, 1)
      date.factPeriod2 = new Date(date.factPeriod.getFullYear(), date.factPeriod.getMonth() - 2, 1)
      date.budgetPeriod2 = new Date(date.budgetPeriod.getFullYear(), date.budgetPeriod.getMonth() + 1, 1)
      date.budgetPeriod3 = new Date(date.budgetPeriod.getFullYear(), date.budgetPeriod.getMonth() + 2, 1)
      if (isMatch(postObject.boardId, postObject.boardIdBudget)) {
        date.budgetPeriodCurrent = date.budgetPeriod
      } else if (isMatch(postObject.boardId, postObject.boardIdBudget2)) {
        date.budgetPeriodCurrent = date.budgetPeriod2
      } else if (isMatch(postObject.boardId, postObject.boardIdBudget3)) {
        date.budgetPeriodCurrent = date.budgetPeriod3
      }
    }
    if (isMatch(postObject.boardId, postObject.boardIdFact)) {
      date.period = date.factPeriod
    } else if (isMatch(postObject.boardId, postObject.boardIdFact0)) {
      date.period = date.factPeriod1
    } else if (isMatch(postObject.boardId, postObject.boardIdBudget)) {
      date.period = date.budgetPeriod
    } else if (isMatch(postObject.boardId, postObject.boardIdBudget2)) {
      date.period = date.budgetPeriod2
    } else if (isMatch(postObject.boardId, postObject.boardIdBudget3)) {
      date.period = date.budgetPeriod3
    } else if (isMatch(postObject.boardId, postObject.boardIdTarget)) {
      date.period = date.factPeriod
    }
    date.ymd = getYMD(date.period).ymd
    return date
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getSum(postObject) {
  try {
    const sum = {}
    const totalSum = {}
    const budgetSum = getTotalSum(postObject, postObject.dataTrello.current.budget)
    const factSum = getTotalSum(postObject, postObject.dataTrello.current.fact)
    totalSum.totalRest = factSum.restSum + factSum.incomeSum - factSum.expenseSum
    totalSum.billBudgetRest = budgetSum.billSum - factSum.billSum
    totalSum.accountBudgetRest = budgetSum.accountSum - factSum.accountSum
    totalSum.nomenclatureBudgetRest = budgetSum.nomenclatureSum - factSum.nomenclatureSum
    let transferCoef
    if (isMatch(postObject.cfo, 'Илья')) {
      transferCoef = (70 / 100).toFixed(2)
    } else if (isMatch(postObject.cfo, 'Оксана')) {
      transferCoef = 1
    } else {
      transferCoef = 1
    }
    totalSum.firstTransferToFamilyAccount = ((factSum.restSum + budgetSum.salarySum + budgetSum.accumulationNomenclatureIncomeSum) - (budgetSum.expenseSum - budgetSum.transferToFamilyAccountSum) * transferCoef).toFixed(0)
    if (factSum.nomenclatureSum != 0 && budgetSum.nomenclatureSum != 0) {
      totalSum.nomenclatureBudgetExecution = ((factSum.nomenclatureSum / budgetSum.nomenclatureSum) * 100).toFixed(2)
    } else {
      totalSum.nomenclatureBudgetExecution = 0
    }
    if (factSum.accountSum != 0 && budgetSum.accountSum != 0) {
      totalSum.accountBudgetExecution = ((factSum.accountSum / budgetSum.accountSum) * 100).toFixed(2)
    } else {
      totalSum.accountBudgetExecution = 0
    }
    budgetSum.nomenclatureRows.length != 0 ? totalSum.haveBudget = true : totalSum.haveBudget = false
    sum.budgetSum = budgetSum
    sum.factSum = factSum
    sum.totalSum = totalSum
    return sum
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getTarget(postObject) {
  try {
    const array = postObject.goalsArray
    const object = {}
    object.array = array.reduce(function (row, array, index) {
      if (index != 0) {
        const object = {}
        object.id = array[0]
        object.listName = array[1]
        object.goal = array[2]
        object.cfo = array[3]
        object.listId = array[5]
        object.status = array[6]
        object.indexRow = index + 1
        row.push(object)
      }
      return row
    }, [])
    object.item = object.array.reduce(function (row, array) {
      if (isMatch(postObject.listName, array.listName)) {
        row = array
      }
      return row
    }, {})
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getTotalSum(postObject, array) {
  /*
   * @array - массив данных для расчета сумм
   */
  try {
    const filterSum = array.reduce(function (sum, array, index) {
      if (index === 0) {
        sum = {}
        sum.cashFlowSum = 0
        sum.billSum = 0
        sum.accountSum = 0
        sum.nomenclatureSum = 0
        sum.incomeSum = 0
        sum.accumulationBillIncomeSum = 0
        sum.accumulationNomenclatureIncomeSum = 0
        sum.salarySum = 0
        sum.expenseSum = 0
        sum.costSum = 0
        sum.accumulationBillExpenseSum = 0
        sum.transferBillExpenseSum = 0
        sum.accumulationNomenclatureExpenseSum = 0
        sum.transferToFamilyAccountSum = 0
        sum.restSum = 0
      }
      if (isMatch(array.cfo, postObject.cfo)) {
        if (isMatch(array.cashFlow, postObject.cashFlow)) {
          //* сумма по операции
          sum.cashFlowSum += array.sum
          if (isMatch(array.bill, postObject.bill)) {
            //* сумма по счету
            sum.billSum += array.sum
            if (isMatch(array.account, postObject.account)) {
              //* сумма по статье
              sum.accountSum += array.sum
              if (isMatch(array.nomenclature, postObject.nomenclature)) {
                //* сумма по номенклатуре
                sum.nomenclatureSum += array.sum
              }
            }
          }
        }
        if (isMatch(array.cashFlow, 'Пополнение')) {
          //* сумма по операции пополнение
          sum.incomeSum += array.sum
          if (isMatch(array.bill, 'Накопления')) {
            //* сумма по статье накопления в приходах
            sum.accumulationBillIncomeSum += array.sum
          }
          if (isMatch(array.nomenclature, 'Уменьшение накоплений')) {
            //* сумма по номенклатуре накопления в приходах
            sum.accumulationNomenclatureIncomeSum += array.sum
          }
          if (isMatch(array.nomenclature, 'Зарплата')) {
            //* сумма по зарплате
            sum.salarySum += array.sum
          }
        } else if (isMatch(array.cashFlow, 'Списание')) {
          //* сумма по операции списание
          sum.expenseSum += array.sum
          if (isMatch(array.bill, 'Затраты')) {
            //* сумма по статье затраты
            sum.costSum += array.sum
          } else if (isMatch(array.bill, 'Накопления')) {
            //* сумма по статье накопления в расходах
            sum.accumulationBillExpenseSum += array.sum
          } else if (isMatch(array.bill, 'Переводы')) {
            //* сумма по статье переводы в расходах
            sum.transferBillExpenseSum += array.sum
          }
          if (isMatch(array.nomenclature, 'Увеличение накоплений')) {
            //* сумма по номенклатуре накопления в расходах
            sum.accumulationNomenclatureExpenseSum += array.sum
          } else if (isMatch(array.nomenclature, 'Перевод на счет Семья')) {
            //* сумма по переводу на счет семьи
            sum.transferToFamilyAccountSum += array.sum
          }
        } else if (isMatch(array.cashFlow, 'Остатки')) {
          //* сумма по операции остатки
          sum.restSum += array.sum
        }
      }
      return sum
    }, {})
    let total = {}
    total = Object.assign({}, filterSum)
    //* данные по статьям с агрегацией
    const groupAccount = array.reduce(function (newArray, array) {
      if (isMatch(array.cfo, postObject.cfo)) {
        if (!newArray[array.account]) {
          newArray[array.account] = {}
          newArray[array.account].bill = array.bill
          newArray[array.account].account = array.account
          newArray[array.account].sum = 0
        }
        newArray[array.account].sum += array.sum
      }
      return newArray
    }, {})
    total.groupAccount = Object.keys(groupAccount).map(function (k) {
      const item = groupAccount[k]
      return {
        bill: item.bill,
        account: item.account,
        sum: item.sum
      }
    })
    total.groupAccount.sort(function (a, b) {
      const nameA = a.bill.toLowerCase()
      const nameB = b.bill.toLowerCase()
      if (nameA < nameB) { // сортируем строки по возрастанию
        return -1
      } else if (nameA > nameB) {
        return 1
      } else {
        return 0
      } // Никакой сортировки
    })
    //* данные по счету с агрегацией
    const groupBill = array.reduce(function (newArray, array) {
      if (isMatch(array.cfo, postObject.cfo)) {
        if (!newArray[array.bill]) {
          newArray[array.bill] = {}
          newArray[array.bill].bill = array.bill
          newArray[array.bill].sum = 0
        }
        newArray[array.bill].sum += array.sum
      }
      return newArray
    }, {})
    total.groupBill = Object.keys(groupBill).map(function (k) {
      const item = groupBill[k]
      return {
        bill: item.bill,
        sum: item.sum
      }
    })
    //* данные из учета
    total.nomenclatureRows = array.filter(function (array) {
      return isMatch(array.cfo, postObject.cfo) && isMatch(array.bill, postObject.bill) && isMatch(array.account, postObject.account) && isMatch(array.nomenclature, postObject.nomenclature) && isMatch(array.cashFlow, postObject.cashFlow)
    })
    return total
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function isOldData(postObject) {
  try {
    //* добавление строк на страницу
    const targetArray = postObject.dataTrello.all
    return targetArray.reduce(function (row, array) {
      if (isMatch(array.actionId, postObject.actionId)) {
        row = true
      }
      return row
    }, false)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function parseComment(postObject) {
  try {
    const parseData = {}
    const text = postObject.text
    parseData.sum = +text.match(/^\d+/)
    parseData.comment = text.split(parseData.sum).join('').replace(/^[.,\,, ,\-,\/,\\]/, ' ').trim()
    return parseData
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateBalanceCard(postObject) {
  /*
   * @postObject - данные реквеста
   */
  try {
    //* обновление карточки баланса
    const postObjectBalance = copyObject(postObject)
    postObjectBalance.nomenclature = 'Баланс'
    const balanceCard = getCards(postObjectBalance, postObjectBalance.listId).item
    postObjectBalance.cardId = balanceCard.id
    addCardComment(postObjectBalance)
    if (postObjectBalance.isBudget || postObjectBalance.isTarget) {
      const description = getDescription(postObjectBalance)
      postObjectBalance.cardDescription = description.text
      updateCardDesc(postObjectBalance)
    }
    postObjectBalance.telegramChatId.forEach(function (id) {
      postObjectBalance.telegramChatId = id
      sendMessageTelegram(postObjectBalance)
    })
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateDescForNewCards(postObject) {
  try {
    const cards = getCards(postObject).array
    const postObjectCard = copyObject(postObject)
    postObjectCard.dataTrello = getAllDataTrello(postObjectCard)
    //* обновление описание карточки
    cards.forEach(function (card) {
      postObjectCard.cardId = card.id
      postObjectCard.cardName = card.name
      postObjectCard.cardLabelColor = getCardLabel(postObjectCard).item.color
      postObjectCard.accountingItem = getAccountingItem(postObjectCard)
      postObjectCard.cashFlow = postObjectCard.accountingItem.item.cashFlow
      postObjectCard.bill = postObjectCard.accountingItem.item.bill
      postObjectCard.account = postObjectCard.accountingItem.item.account
      postObjectCard.nomenclature = card.name
      const description = getDescription(postObjectCard)
      if (description.haveBudget) {
        postObjectCard.cardDescription = description.text
        updateCardDesc(postObjectCard)
      }
    })
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateParametr(postObject) {
  /*
   * обновление параметра
   * @postObject - входные параметра запроса
   * @value - значение параметра. Изменяемое
   * */
  try {
    const ss = postObject.parametrSheetOpen
    let indexRow
    let value
    const postObjectCopy = copyObject(postObject)
    if (postObject.isCurrFact) {
      postObjectCopy.type = 'Факт'
      indexRow = getParametr(postObjectCopy).item.indexRow
      value = new Date(postObjectCopy.factPeriod.getFullYear(), postObjectCopy.factPeriod.getMonth() + 1, 1)
      ss.getRange(indexRow, 4).setValue(formatterDate(value).date)
      ss.getRange(indexRow, 5).setValue(formatterDate().timestamp)
    } else if (postObject.isCurrBudget) {
      postObjectCopy.isFact = false
      postObjectCopy.isBudget = true
      postObjectCopy.type = 'Бюджет'
      indexRow = getParametr(postObjectCopy).item.indexRow
      value = new Date(postObjectCopy.budgetPeriod.getFullYear(), postObjectCopy.budgetPeriod.getMonth() + 1, 1)
      ss.getRange(indexRow, 4).setValue(formatterDate(value).date)
      ss.getRange(indexRow, 5).setValue(formatterDate().timestamp)
    }
    postObject.parametrArray = getGoogleSheetValues(postObject.parametrSheetOpen)
    postObject.date = getPeriod(postObject)
    postObject.period = postObject.date.period
    postObject.ymd = postObject.date.ymd
    postObject.factPeriod1 = postObject.date.factPeriod1
    postObject.factPeriod = postObject.date.factPeriod
    postObject.budgetPeriod = postObject.date.budgetPeriod
    postObject.budgetPeriod2 = postObject.date.budgetPeriod2
    postObject.budgetPeriod3 = postObject.date.budgetPeriod3
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateRowByActionId(postObject) {
  /*
   * @postObject - данные реквеста
   * */
  try {
    const sourceRowIndex = []
    //* обновление данных на листе источнике
    const ss = postObject.trelloOpen
    const sourceData = postObject.trelloArray
    sourceData.reduce(function (row, array, index) {
      if (isMatch(array[10], postObject.actionId)) {
        row = index + 1
        sourceRowIndex.push(row)
      }
      return row
    }, [])
    sourceRowIndex.forEach(function (row) {
      ss.getRange(row, 1).setValue(postObject.actionDate)
      ss.getRange(row, 4).setValue(postObject.mvz)
      ss.getRange(row, 9).setValue(postObject.sum)
      ss.getRange(row, 10).setValue(postObject.comment)
    })
    //* обновление данных в массиве источника
    sourceData.map(function (array) {
      if (isMatch(array[10], postObject.actionId)) {
        array[0] = postObject.actionDate
        array[1] = postObject.mvz
        array[8] = postObject.sum
        array[9] = postObject.comment
      }
    })
    postObject.dataTrello = getAllDataTrello(postObject)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

// обновление параметра
function updateTarget(postObject) {
  /*
   * @postObject - входные параметра запроса
   * @value - значение параметра. Изменяемое
   * */
  try {
    const ss = postObject.goalsSheetOpen
    const indexRow = getTarget(postObject).item.indexRow
    ss.getRange(indexRow, 5).setValue(formatterDate().timestamp)
    ss.getRange(indexRow, 7).setValue('closed')
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateTrelloData(postObject) {
  try {
    let insertdate
    //* вставка значений в буфер
    const ss = postObject.trelloOpen
    const trelloArray = postObject.trelloArray
    let pushBufferRow = [postObject.actionDate, postObject.period, postObject.cfo, postObject.mvz, postObject.cashFlow, postObject.bill, postObject.account, postObject.nomenclature, postObject.sum, postObject.comment, postObject.actionId, postObject.type]
    ss.appendRow(pushBufferRow)
    trelloArray.push(pushBufferRow)
    //* Проверка перевода на счет семьи
    if (isMatch(postObject.account, 'Перевод на счет Семья')) {
      insertdate = new Date(postObject.actionDate.getTime() + 1000)
      if (isMatch(postObject.cfo, 'Илья')) {
        pushBufferRow = [insertdate, postObject.period, 'Семья', 'Семья', 'Пополнение', 'Переводы', 'Приход со счета Илья', 'Приход со счета Илья', postObject.sum, postObject.comment, postObject.actionId, postObject.type]
        ss.appendRow(pushBufferRow)
        trelloArray.push(pushBufferRow)
      } else if (isMatch(postObject.cfo, 'Оксана')) {
        pushBufferRow = [insertdate, postObject.period, 'Семья', 'Семья', 'Пополнение', 'Переводы', 'Приход со счета Оксана', 'Приход со счета Оксана', postObject.sum, postObject.comment, postObject.actionId, postObject.type]
        ss.appendRow(pushBufferRow)
        trelloArray.push(pushBufferRow)
      }
    }
    //* получение данных учета после обновления
    postObject.dataTrello = getAllDataTrello(postObject)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateTargetList(postObject) {
  try {
    const targetItem = getAllTarget(postObject).item
    const ssTargetOpen = postObject.targetOpen
    let targetColumn
    let targetSumOld
    let targetSumNew
    let actionSum
    if (isMatch(postObject.bill, 'Накопления')) {
      if (isMatch(postObject.account, 'Цели')) {
        targetColumn = 15
        targetSumOld = targetItem.targetSum
      } else if (isMatch(postObject.account, 'Депозит')) {
        targetColumn = 16
        targetSumOld = targetItem.depositSum
      } else if (isMatch(postObject.account, 'Биржа')) {
        targetColumn = 17
        targetSumOld = targetItem.exchangeSum
      } else if (isMatch(postObject.account, 'ИИС')) {
        targetColumn = 18
        targetSumOld = targetItem.iisSum
      }
      //? продумать как определять цель при списании в затраты
    } else if (isMatch(postObject.bill, 'Затраты')) {
      if (isMatch(targetItem.goal, postObject.mvz)) {
        targetColumn = 19
        targetSumOld = targetItem.disbursedFunds
      }
    }
    if (isMatch(postObject.actionType, 'commentCard')) {
      actionSum = postObject.sum
    } else if (isMatch(postObject.actionType, 'deleteComment')) {
      actionSum = -1 * postObject.sum
    } else if (isMatch(postObject.actionType, 'updateComment')) {
      actionSum = postObject.sum - postObject.oldSum
    }
    if (isMatch(postObject.cashFlow, 'Списание')) {
      targetSumNew = targetSumOld + actionSum
    } else if (isMatch(postObject.cashFlow, 'Пополнение')) {
      targetSumNew = targetSumOld - actionSum
    }
    ssTargetOpen.getRange(targetItem.indexRow, targetColumn).setValue(+targetSumNew)
    postObject.targetArray = getGoogleSheetValues(postObject.targetOpen)
    postObject.targetSumOld = targetSumOld
    postObject.targetSumNew = targetSumNew
    postObject.actionSum = actionSum
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}


function getAllDataTrello(postObject) {
  /*
   * @source - истоник: trello, account
   */
  try {
    const data = postObject.trelloArray
    const object = {}
    object.all = data.reduce(function (row, array, index) {
      if (index != 0) {
        const object = {}
        //* данные из буфера трелло
        object.actionDate = array[0]
        object.period = array[1]
        object.ymd = getYMD(array[1]).ymd
        object.cfo = array[2]
        object.mvz = array[3]
        object.cashFlow = array[4]
        object.bill = array[5]
        object.account = array[6]
        object.nomenclature = array[7]
        object.sum = array[8]
        object.comment = array[9]
        object.actionId = array[10]
        object.type = array[11]
        object.indexRow = index + 1
        row.push(object)
      }
      return row
    }, [])
    object.current = {}
    object.current.fact = object.all.filter(function (row) {
      return row.ymd == getYMD(postObject.factPeriod).ymd && isMatch(row.type, 'Факт')
    })
    object.current.budget = object.all.filter(function (row) {
      return row.ymd == getYMD(postObject.budgetPeriodCurrent).ymd && isMatch(row.type, 'Бюджет')
    })
    return object
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getPreviousFact(postObject) {
  try {
    const sum = {}
    const postObjectPrevCurrent = copyObject(postObject)
    postObjectPrevCurrent.factPeriod = postObject.factPeriod
    // postObjectPrevCurrent.dataAccount = getAllDataAccount(postObjectPrevCurrent)
    postObjectPrevCurrent.dataTrello = getAllDataTrello(postObjectPrevCurrent)
    sum.Prev0 = getSum(postObjectPrevCurrent)
    const postObjectPrev1 = copyObject(postObject)
    postObjectPrev1.factPeriod = postObject.factPeriod1
    // postObjectPrev1.dataAccount = getAllDataAccount(postObjectPrev1)
    postObjectPrev1.dataTrello = getAllDataTrello(postObjectPrev1)
    sum.Prev1 = getSum(postObjectPrev1)
    return sum
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function isUser(postData) {
  try {
    const botUser = ['5e2b5f3f409c544ebdb1b9d4']
    return botUser.reduce(function (row, array) {
      if (isMatch(array, postData.action.memberCreator.id)) {
        row = false
      }
      return row
    }, true)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function isValidateAction(postData) {
  try {
    const actionType = ['commentCard', 'updateComment', 'deleteComment', 'createList', 'updateList', 'updateCard']
    return actionType.reduce(function (row, array) {
      if (isMatch(postData.action.type, array)) {
        if (isMatch(postData.action.type, 'updateCard')) {
          if (isMatch(postData.action.data.card.name, 'Баланс')) {
            row = true
          }
        } else {
          row = true
        }
      }
      return row
    }, false)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents)
    if (addLog(postData)) {
      var postObject = getPostObject(postData)
      if (isMatch(postObject.actionType, 'commentCard')) {
        //* добавление информации
        updateTrelloData(postObject)
        if (postObject.isTarget) {
          //* обновление листа цель
          updateTargetList(postObject)
        }
        //* получение описание карточки и комментария
        postObject.cardDescription = getDescription(postObject).text
        const comment = getComment(postObject)
        postObject.cardComment = comment.text
        postObject.telegramMessage = comment.message
        //* обновление описание карточки
        updateCardDesc(postObject)
        //* обновление карточки баланса
        updateBalanceCard(postObject)
      } else if (isMatch(postObject.actionType, 'updateComment') && postObject.isOldData) {
        //* обновление данных при изменении комментария
        updateRowByActionId(postObject)
        if (postObject.isTarget) {
          //* обновление листа цель
          updateTargetList(postObject)
        }
        postObject.cardDescription = getDescription(postObject).text
        const comment = getComment(postObject)
        postObject.cardComment = comment.text
        postObject.telegramMessage = comment.message
        //* обновление описание карточки
        updateCardDesc(postObject)
        //* обновление карточки баланса
        updateBalanceCard(postObject)
      } else if (isMatch(postObject.actionType, 'deleteComment') && postObject.isOldData) {
        //* удаление строки при удалении комментария
        postObject.sum = deleteRowByActionId(postObject)
        if (postObject.isTarget) {
          //* обновление листа цель
          updateTargetList(postObject)
        }
        postObject.cardDescription = getDescription(postObject).text
        const comment = getComment(postObject)
        postObject.cardComment = comment.text
        postObject.telegramMessage = comment.message
        //* обновление описание карточки
        updateCardDesc(postObject)
        //* обновление карточки баланса
        updateBalanceCard(postObject)
      } else if (isMatch(postObject.actionType, 'createList')) {
        if (postObject.isFact || postObject.isBudget) {
          addFinancialCenter(postObject)
          postObject.cfo = postObject.listName
          if (postObject.isFact) {
            postObject.type = 'Факт'
          } else if (postObject.isBudget) {
            postObject.type = 'Бюджет'
          }
          createCardsForList(postObject)
          updateDescForNewCards(postObject)
        } else if (postObject.isTarget) {
          addTarget(postObject)
          createCardsForList(postObject)
        }
      } else if (isMatch(postObject.actionType, 'updateList')) {
        if (postObject.isTarget && postObject.listClosed) {
          updateTarget(postObject)
        }
      } else if (isMatch(postObject.actionType, 'updateCard')) {
        if (postObject.cardClosed && isMatch(postObject.cardName, 'Баланс')) {
          if (postObject.isCurrFact) {
            //* закрытие фактического периода
            updateParametr(postObject)
            closedFactPeriod(postObject)
            updateDescForNewCards(postObject)
          } else if (postObject.isCurrBudget) {
            //* закрытие бюджетного периода
            updateParametr(postObject)
            closedBudgetPeriod(postObject)
          }
        }
      }
      //* удаление старых логов
      deleteLog(postObject)
      //* удаление старых ошибок
      deleteError(postObject)
      //* Удаление пустых строк
      deleteEmptyRow(postObject)
    }
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  } finally {
    if (isMatch(postObject.actionType, 'commentCard')) {
      //* добавление реакции на комментарий
      addCardReaction(postObject)
    }
  }
}