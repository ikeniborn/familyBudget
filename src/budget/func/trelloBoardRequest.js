function addBoardLabel(postObject, labelName, labelColor, boardId) {
  /*
   * @postObject - входные параметра запроса
   * @labelName - входной параметр имени метки
   * @labelColor - входной параметр цвета метки
   * @boardId - входной параметр ID доски trello
   */
  try {
    var data = {
      method: 'post',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'labels?name=' + labelName + '&color=' + labelColor + '&idBoard=' + boardId + '&' + postObject.keyAndToken, data)
    var variable = {}
    variable.id = JSON.parse(resp).id
    variable.name = JSON.parse(resp).name
    return variable
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function getBoardLabel(postObject, boardId) {
  /*
   * @postObject - входные параметра запроса
   * @boardId - входной параметр ID листа trello
   **/
  try {
    var data = {
      method: 'get',
      contentType: 'application/json'
    }
    var resp = UrlFetchApp.fetch(postObject.apiRoot + 'boards/' + boardId + '/labels?fields=all&limit=10&' + postObject.keyAndToken, data)
    var respData = JSON.parse(resp)
    var respArray = []
    respData.reduce(function (variable, array) {
      variable = {}
      variable.id = array.id
      variable.name = array.name
      variable.color = array.color
      return respArray.push(variable)
    }, {})
    return respArray
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function updateBoard(postObject, boardId, boardName) {
  /*
   * @postObject - входные параметра запроса
   * @boardName - входной параметр наименования доски trello
   * @boardId - входной параметр ID доски trello
   */
  try {
    var data = {
      method: 'put',
      contentType: 'application/json'
    }
    UrlFetchApp.fetch(postObject.apiRoot + 'boards/' + boardId + '?name=' + boardName + '&' + postObject.keyAndToken, data)
  } catch (e) {

    addErrorItem(arguments.callee.name + ': ' + e)
  }
}