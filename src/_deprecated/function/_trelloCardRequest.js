function addCard(postObject, cardName, listId, pos, labelId) {
  /*
   * @postObject - входные параметра запроса
   * @cardName - входной параметр наименования карточки trello
   * @listId - входной параметр ID листа trello
   * @labelId - входной параметр ID метки trello
   * @pos - позиция карточки на листе
   */
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    var resp
    var position
    pos == undefined ? position = 'bottom' : position = pos
    if (labelId == undefined) {
      resp = UrlFetchApp.fetch(postObject.apiRoot + '/cards?pos=' + position + '&name=' + cardName + '&idList=' + listId + '&' + postObject.keyAndToken, data)
    } else {
      resp = UrlFetchApp.fetch(postObject.apiRoot + '/cards?pos=' + position + '&name=' + cardName + '&idList=' + listId + '&idLabels=' + labelId + '&' + postObject.keyAndToken, data)
    }
    var variable = {}
    variable.id = JSON.parse(resp).id
    variable.name = JSON.parse(resp).name
    return variable
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function addCardComment(postObject) {
  /*
   * @postObject - входные параметра запроса
   * @comment - текст комментария
   */
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + 'cards/' + postObject.cardId + '/actions/comments?text=' + postObject.cardComment + '&' + postObject.keyAndToken, data)
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

// добавление реакции в трелло
function addCardReaction(postObject) {
  /*
   * @postObject - входные параметра запроса
   */
  try {
    const reactions = []
    if (isMatch(postObject.memberId, '55cb5c5729ae976dfd2b901e')) {
      if (postObject.sum > 500) {
        reactions.push(postObject.scream)
      } else {
        reactions.push(postObject.buuReaction)
      }
      reactions.push(postObject.moneyBag)
    } else {
      reactions.push(postObject.moneyBag)
    }
    reactions.forEach(function (reaction) {
      var payload = JSON.stringify(reaction)
      var data = {
        method: 'post',
        contentType: 'application/json',
        payload: payload
      }
      UrlFetchApp.fetch(postObject.apiRoot + 'actions/' + postObject.actionId + '/reactions?' + postObject.keyAndToken, data)
    })
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function archiveAllCards(postObject) {
  /*
   * @postObject - входные параметра запроса
   * @listId - входной параметр идентификатора листа trello
   **/
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + 'lists/' + postObject.listId + '/archiveAllCards?' + postObject.keyAndToken, data)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function closeCard(postObject, cardId) {
  /*
   * @postObject - входные параметра запроса
   * @cardId - входной параметр ID карточки trello
   **/
  try {
    var data = {
      method: 'put',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + '/cards/' + cardId + '?closed=true&' + postObject.keyAndToken, data)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function copyCard(postObject, listId, idCardSource) {
  /*
   * @postObject - входные параметра запроса
   * @listId - входной параметр ID листа trello
   * @idCardSource - входной параметр ID карточки - исходника trello
   **/
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + '/cards?pos=bottom&idList=' + listId + '&idCardSource=' + idCardSource + '&keepFromSource=attachments,checklists,due,members,stickers&' + postObject.keyAndToken, data)
    var variable = {}
    variable.id = JSON.parse(resp).id
    variable.name = JSON.parse(resp).name
    return variable
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getCardLabel(postObject) {
  /*
   * @postObject - входные параметра запроса
   **/
  try {
    var data = {
      method: 'get',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'cards/' + postObject.cardId + '/labels?' + postObject.keyAndToken, data)
    var respData = JSON.parse(resp)
    var variable = {}
    variable.item = {}
    variable.array = []
    respData.reduce(function (row, array, index) {
      if (index == 0) {
        row = {}
        row.id = array.id
        row.name = array.name
        row.color = array.color
        variable.item = row
        variable.array.push(row)
      } else {
        row = {}
        row.id = array.id
        row.name = array.name
        row.color = array.color
        variable.array.push(row)
      }
    }, {})
    return variable
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getCardList(postObject) {
  /*
   * @postObject - входные параметра запроса
   **/
  try {
    var data = {
      method: 'get',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'cards/' + postObject.cardId + '/list?&' + postObject.keyAndToken, data)
    var respData = JSON.parse(resp)
    var variable = {}
    variable.id = respData.id
    variable.name = respData.name
    return variable
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getCards(postObject) {
  /*
   * @postObject - входные параметра запроса
   * @listId - входной параметр ID листа trello
   **/
  try {
    var data = {
      method: 'get',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'lists/' + postObject.listId + '/cards?' + postObject.keyAndToken, data)
    var respData = JSON.parse(resp)
    var cards = {}
    cards.item = {}
    cards.array = []
    respData.reduce(function (variable, array) {
      if (array.name == postObject.nomenclature) {
        variable = {}
        variable.id = array.id
        variable.name = array.name
        cards.item = variable
        cards.array.push(variable)
      } else {
        variable = {}
        variable.id = array.id
        variable.name = array.name
        cards.array.push(variable)
      }
    }, [])
    return cards
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function moveAllCards(postObjectOld, postObjectNew) {
  /*
   * @postObjectOld
   * @postObjectNew
   **/
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObjectOld.apiRoot + 'lists/' + postObjectOld.listId + '/moveAllCards?idBoard=' + postObjectNew.boardId + '&idList=' + postObjectNew.listId + '&' + postObjectOld.keyAndToken, data)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function moveCard(postObject) {
  /*
   * @postObject - входные параметра запроса
   **/
  try {
    var data = {
      method: 'put',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + 'cards/' + postObject.cardId + '/idBoard?value=' + postObject.boardId + '&idList=' + postObject.listId + '&' + postObject.keyAndToken, data)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateCardDesc(postObject) {
  /*
   * @postObject - входные параметра запроса
   */
  try {
    var data = {
      method: 'put',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + 'cards/' + postObject.cardId + '?desc=' + postObject.cardDescription + '&' + postObject.keyAndToken, data)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}