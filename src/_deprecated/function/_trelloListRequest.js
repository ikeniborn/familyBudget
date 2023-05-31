function addList(postObject) {
  /*
   * @postObject - входные параметра запроса
   * @labelName - входной параметр имени метки
   * @boardId - входной параметр ID доски trello
   */
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'lists/?name=' + postObject.listName + '&idBoard=' + postObject.boardId + '&' + postObject.keyAndToken, data)
    var variable = {}
    variable.id = JSON.parse(resp).id
    variable.name = JSON.parse(resp).name
    return variable
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function closedList(postObject) {
  /*
   * @postObject - входные параметра запроса
   * @listId - входной параметр ID листа trello
   **/
  try {
    var data = {
      method: 'put',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + 'lists/' + postObject.listId + '/closed?value=true&' + postObject.keyAndToken, data)
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function copyList(postObject, postObjectNew) {
  /*
   * @postObject - входные параметра запроса
   * @postObjectNew - входной параметр обновленные
   **/
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'lists/?name=' + postObjectNew.listName + '&idBoard=' + postObjectNew.boardId + '&idListSource=' + postObject.idListSource + '&pos=bottom&' + postObject.keyAndToken, data)
    var variable = {}
    variable.id = JSON.parse(resp).id
    variable.name = JSON.parse(resp).name
    return variable
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getList(postObject) {
  /*
   * @postObject - входные параметра запроса
   * @boardId - входной параметр ID доски trello
   **/
  try {
    var data = {
      method: 'get',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'boards/' + postObject.boardId + '/lists?cards=none&' + postObject.keyAndToken, data)
    var respData = JSON.parse(resp)
    var listArray = {}
    respData.reduce(function (variable, array) {
      var listName = array.name
      var postObjectCfo = postObject.cfo
      if (listName.toLowerCase().match(postObjectCfo.toLowerCase())) {
        variable = {}
        variable.id = array.id
        variable.name = array.name
        listArray = variable
      }
    }, {})
    return listArray
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function moveList(postObject, postObjectNew) {
  /*
   * @postObject - входные параметра запроса
   * @postObjectNew - входной параметр обновленный
   */
  try {
    var data = {
      method: 'put',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + 'lists/' + postObject.listId + '/idBoard?value=' + postObjectNew.boardId + '&' + postObject.keyAndToken, data)
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateList(postObject) {
  /*
   * @postObject - входные параметра запроса
   * @listName - входной параметр ID листа trello
   * @listName - входной параметр нового имени листа trello
   **/
  try {
    var data = {
      method: 'put',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + 'lists/' + postObject.listId + '?name=' + postObject.listName + '&' + postObject.keyAndToken, data)
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}