class TrelloApi {
  /**
   *
   * @param {object} apiParametrs
   */
  constructor(apiParametrs) {
    this.url = apiParametrs.url
    this.key = apiParametrs.key
    this.token = apiParametrs.token
  }
  fetchMethod(urlParams, data) {
    const responce = UrlFetchApp.fetch(
      this.url + urlParams + 'key=' + this.key + '&token=' + this.token,
      data
    )
    return JSON.parse(responce)
  }
}

class TrelloMethod extends TrelloApi {
  constructor(apiParametrs) {
    super(apiParametrs)
    this.constantParams = {
      muteHttpExceptions: false,
      contentType: 'application/json',
    }
  }
  post(urlParams) {
    const data = Object.assign(
      {
        method: 'post',
      },
      this.constantParams
    )
    return super.fetchMethod(urlParams, data)
  }
  put(urlParams) {
    const data = Object.assign(
      {
        method: 'put',
      },
      this.constantParams
    )
    return super.fetchMethod(urlParams, data)
  }
  get(urlParams) {
    const data = Object.assign(
      {
        method: 'get',
      },
      this.constantParams
    )
    return super.fetchMethod(urlParams, data)
  }
}

class TrelloBoard extends TrelloMethod {
  constructor(apiParametrs, boardId) {
    super(apiParametrs)
    this.boardId = boardId
  }
  addLabel(name, color) {
    const urlParams =
      'labels?name=' +
      name +
      '&color=' +
      color +
      '&idBoard=' +
      this.boardId +
      '&'
    const fetchData = super.post(urlParams)
    return { id: fetchData.id, name: fetchData.name }
  }
  getLabel(color) {
    const urlParams = 'boards/' + this.boardId + '/labels?fields=all&limit=10&'
    const fetchData = super.get(urlParams)
    const label = fetchData.filter((label) => {
      return label.color === color
    })
    return label[0]
  }
  updateName(name) {
    const urlParams = 'boards/' + this.boardId + '?name=' + name + '&'
    super.post(urlParams)
  }
  getLists() {
    const urlParams = 'boards/' + this.boardId + '/lists?cards=none&'
    const fetchData = super.get(urlParams)
    const lists = fetchData.map((list) => {
      return { id: list.id, name: list.name, color: list.color }
    })
    return lists
  }
  addList(listName) {
    const urlParams =
      'lists/?name=' + listName + '&idBoard=' + this.boardId + '&'
    const fetchData = super.post(urlParams)
    return new TrelloList(APITRELLO, fetchData.id)
  }
}

class TrelloList extends TrelloMethod {
  constructor(apiParametrs, listId) {
    super(apiParametrs)
    this.listId = listId
  }
  get boardId() {
    const urlParams = 'lists/' + this.listId + '?'
    const fetchData = super.get(urlParams)
    return fetchData.idBoard
  }
  get listName() {
    const urlParams = 'lists/' + this.listId + '?'
    const fetchData = super.get(urlParams)
    return fetchData.name
  }
  close() {
    const urlParams = 'lists/' + this.listId + '/closed?value=true&'
    super.put(urlParams)
  }
  moveToBoard(boardId) {
    const urlParams = 'lists/' + this.listId + '/idBoard?value=' + boardId + '&'
    super.put(urlParams)
  }
  updateName(listName) {
    const urlParams = 'lists/' + this.listId + '?name=' + listName + '&'
    super.put(urlParams)
  }
  getAllCards() {
    const urlParams = 'lists/' + this.listId + '/cards?'
    const fetchData = super.get(urlParams)
    const cardArray = fetchData.map((card) => {
      return { id: card.id, name: card.name }
    })
    return cardArray
  }
  moveAllCards(newListId) {
    const newList = new TrelloList(APITRELLO, newListId)
    const urlParams =
      'lists/' +
      this.listId +
      '/moveAllCards?idBoard=' +
      newList.boardId +
      '&idList=' +
      newListId +
      '&'
    super.post(urlParams)
  }
  archiveAllCards() {
    const urlParams = 'lists/' + this.listId + '/archiveAllCards?'
    super.post(urlParams)
  }
  addCard(cardName, position, labelId) {
    const urlParams =
      'cards?pos=' +
      position +
      '&name=' +
      cardName +
      '&idList=' +
      this.listId +
      '&idLabels=' +
      labelId +
      '&'
    const fetchData = super.post(urlParams)
    return new TrelloCard(APITRELLO, fetchData.id)
  }
}

class TrelloCard extends TrelloMethod {
  constructor(apiParametrs, cardId) {
    super(apiParametrs)
    this.cardId = cardId
  }
  get listId() {
    const urlParams = 'cards/' + this.cardId + '/list?&'
    const fetchData = super.get(urlParams)
    return fetchData.id
  }
  get boardId() {
    const urlParams = 'cards/' + this.cardId + '/list?&'
    const fetchData = super.get(urlParams)
    return fetchData.idBoard
  }
  get labels() {
    const urlParams = 'cards/' + this.cardId + '/labels?'
    const fetchData = super.get(urlParams)
    return fetchData
  }
  addComment(comment) {
    const urlParams =
      'cards/' + this.cardId + '/actions/comments?text=' + comment + '&'
    super.post(urlParams)
  }
  moveToList(listId) {
    const newList = new TrelloList(APITRELLO, newListId)
    const urlParams =
      'cards/' +
      this.cardId +
      '/idBoard?value=' +
      newList.boardId +
      '&idList=' +
      listId +
      '&'
    const fetchData = super.put(urlParams)
    return fetchData.id
  }
  updateDescription(description) {
    const urlParams = 'cards/' + this.cardId + '?desc=' + description + '&'
    super.put(urlParams)
  }
  close() {
    const urlParams = '/cards/' + this.cardId + '?closed=true&'
    super.put(urlParams)
  }
}

class TrelloAction extends TrelloMethod {
  constructor(apiParametrs, actionId) {
    super(apiParametrs)
    this.actionId = actionId
  }
  addCardReaction(reaction) {
    payload = { payload: JSON.stringify(reaction) }
    this.constantParams = Object.assign(this.constantParams, payload)
    const urlParams = 'actions/' + postObject.actionId + '/reactions?'
    super.post(urlParams)
  }
}

class TrelloRequest {
  constructor(e) {
    this.contents = JSON.parse(e.postData.contents)
    if (contents) this.actionType = contents.action.type
  }
  addLog(table) {
    const promise = new Promise(function (resolve) {})
    new GoogleSheet(DATABASE, table)
  }
}
