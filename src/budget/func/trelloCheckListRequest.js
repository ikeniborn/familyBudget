function addCheckList(postObject, cardId, checkListName) {
  /*
   * @postObject - входные параметра запроса
   * @cardId - входной параметр ID карточки trello
   * @checkListName - входной парамтер наименования чеклиста trello
   */
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'cards/' + cardId + '/checklists?name=' + checkListName + '&' + postObject.keyAndToken, data)
    var variable = {}
    variable.id = JSON.parse(resp).id
    variable.name = JSON.parse(resp).name
    return variable
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function addCheckListItem(postObject, checkListId, nameItem) {
  /*
   * @postObject - входные параметра запроса
   * @checkListId - входной параметр ID чеклиста
   * @nameItem - входной параметр ID пункта чеклиста
   */
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'checklists/' + checkListId + '/checkItems?name=' + nameItem + '&pos=bottom&checked=false&' + postObject.keyAndToken, data)
    var variable = {}
    variable.id = JSON.parse(resp).id
    variable.name = JSON.parse(resp).name
    return variable
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getCheckList(postObject, cardId) {
  /*
   * @postObject - входные параметра запроса
   * @cardId - входной параметр ID карточки trello
   **/
  try {
    var data = {
      method: 'get',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'cards/' + cardId + '/checklists?checkItems=all&checkItem_fields=all&filter=all&fields=all&' + postObject.keyAndToken, data)
    var respData = JSON.parse(resp)
    var variable = respData.reduce(function (row, array) {
      if (array.name.match('Бюджет')) {
        row = {}
        row.id = array.id
        row.name = array.id
        row.checkItems = array.checkItems
      }
      return row
    })
    return variable
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}