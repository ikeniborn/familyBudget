import { Methods } from './fetch'
export { Trello, Webhook }

//! Create webhook with deploy the web app will be authorized to run using your account data: Only myself.
//! Use webhook with deploy the web app will be authorized to run using your account data: Anyone.

class Trello {
  constructor(key = '', token = '') {
    this.methods = new Methods(
      'https://api.trello.com',
      {},
      { key, token },
      {
        muteHttpExceptions: true,
        contentType: 'application/json',
      }
    )
  }
}

class Webhook {
  constructor(Trello) {
    this.methods = Trello.methods
  }
  create(callbackURL, idModel, active = true, description = '') {
    return this.methods.post({
      endPoint: '/1/webhooks/',
      query: {
        callbackURL,
        idModel,
        active,
        description,
      },
    })
  }
  get(id) {
    this.methods.get({ endPoint: '/1/webhooks/{id}', path: { id } })
  }

  update(id, callbackURL = '', idModel = '', active = true, description = '') {
    apiLib.method(
      'post',
      '/1/webhooks/{id}',
      { id },
      { callbackURL, idModel, active, description }
    )
  }

  delete(id) {
    return apiLib.method('detele', '/1/webhooks/{id}', { id })
  }

  getFields(id, field) {
    return apiLib.method('get', '/1/webhooks/{id}/{field}', { id, field })
  }
}

class Token {
  constructor() {
    this.token = new Instance().api.permanentParams.query.token
  }

  get(fields = 'all', webhooks = false) {
    return apiLib.method(
      'get',
      '/1/tokens/{token}',
      { token: this.token },
      { fields, webhooks },
      {}
    )
  }

  getMember(fields = 'all') {
    return apiLib.method(
      'get',
      '/1/tokens/{token}/member',
      { token: this.token },
      { fields }
    )
  }

  getWebHooks() {
    return apiLib.method('get', '/1/tokens/{token}/webhooks', {
      token: this.token,
    })
  }

  createWebhook(callbackURL, idModel, description = '') {
    return apiLib.method(
      'post',
      '/1/tokens/{token}/webhooks',
      { token: this.token },
      { callbackURL, idModel, description }
    )
  }
}

class Board {
  constructor(id) {
    this.id = id
  }

  /**
   * Main method for board
   * @returns {object}
   */
  get() {
    return apiLib.method('get', '/1/boards/{id}', { id: this.id })
  }

  addLabel(name, color) {
    if (!name || !color) {
      return new Error('Failed parametr!')
    }
    return apiLib.method(
      'post',
      '/1/boards/{id}/labels',
      { id: this.id },
      {
        name,
        color,
      }
    )
  }

  getLabel(color) {
    return apiLib
      .method('get', '/1/boards/{id}/labels', { id: this.id })
      .filter((label) => {
        return label.color === color
      })[0]
  }

  updateName(name) {
    return apiLib.method('post', '/1/boards/{id}', { id: this.id }, { name })
  }

  getLists() {
    return apiLib
      .method('get', '/1/boards/{id}/lists', { id: this.id }, { cards: 'none' })
      .map((list) => {
        return { id: list.id, name: list.name, color: list.color }
      })
  }

  addList(name) {
    return apiLib.method(
      'post',
      '/1/lists',
      {},
      {
        name,
        idBoard: this.id,
      }
    )
  }
}

// class TrelloList {
//   constructor(listId) {
//     this.listId = listId
//   }
//   get boardId() {
//     const urlParams = 'lists/' + this.listId + '?'
//     const fetchData = super.get(urlParams)
//     return fetchData.idBoard
//   }
//   get listName() {
//     const urlParams = 'lists/' + this.listId + '?'
//     const fetchData = super.get(urlParams)
//     return fetchData.name
//   }
//   close() {
//     const urlParams = 'lists/' + this.listId + '/closed?value=true&'
//     super.put(urlParams)
//   }
//   moveToBoard(boardId) {
//     const urlParams = 'lists/' + this.listId + '/idBoard?value=' + boardId + '&'
//     super.put(urlParams)
//   }
//   updateName(listName) {
//     const urlParams = 'lists/' + this.listId + '?name=' + listName + '&'
//     super.put(urlParams)
//   }
//   getAllCards() {
//     const urlParams = 'lists/' + this.listId + '/cards?'
//     const fetchData = super.get(urlParams)
//     const cardArray = fetchData.map((card) => {
//       return { id: card.id, name: card.name }
//     })
//     return cardArray
//   }
//   moveAllCards(newListId) {
//     const newList = new TrelloList(newListId)
//     const urlParams =
//       'lists/' +
//       this.listId +
//       '/moveAllCards?idBoard=' +
//       newList.boardId +
//       '&idList=' +
//       newListId +
//       '&'
//     super.post(urlParams)
//   }
//   archiveAllCards() {
//     const urlParams = 'lists/' + this.listId + '/archiveAllCards?'
//     super.post(urlParams)
//   }
//   addCard(cardName, position, labelId) {
//     const urlParams =
//       'cards?pos=' +
//       position +
//       '&name=' +
//       cardName +
//       '&idList=' +
//       this.listId +
//       '&idLabels=' +
//       labelId +
//       '&'
//     const fetchData = super.post(urlParams)
//     return new TrelloCard(fetchData.id)
//   }
// }

// class TrelloCard {
//   constructor(cardId) {
//     this.cardId = cardId
//     new Instance()
//   }
//   get listId() {
//     const urlParams = 'cards/' + this.cardId + '/list?&'
//     const fetchData = super.get(urlParams)
//     return fetchData.id
//   }
//   get boardId() {
//     const urlParams = 'cards/' + this.cardId + '/list?&'
//     const fetchData = super.get(urlParams)
//     return fetchData.idBoard
//   }
//   get labels() {
//     const urlParams = 'cards/' + this.cardId + '/labels?'
//     const fetchData = super.get(urlParams)
//     return fetchData
//   }
//   addComment(comment) {
//     const urlParams =
//       'cards/' + this.cardId + '/actions/comments?text=' + comment + '&'
//     super.post(urlParams)
//   }
//   moveToList(listId, newListId) {
//     const newList = new TrelloList(newListId)
//     const urlParams =
//       'cards/' +
//       this.cardId +
//       '/idBoard?value=' +
//       newList.boardId +
//       '&idList=' +
//       listId +
//       '&'
//     const fetchData = super.put(urlParams)
//     return fetchData.id
//   }
//   updateDescription(description) {
//     const urlParams = 'cards/' + this.cardId + '?desc=' + description + '&'
//     super.put(urlParams)
//   }
//   close() {
//     const urlParams = '/cards/' + this.cardId + '?closed=true&'
//     super.put(urlParams)
//   }
// }

// class TrelloAction {
//   constructor(actionId) {
//     new Instance()
//     this.actionId = actionId
//   }
//   addCardReaction(reaction) {
//     payload = { payload: JSON.stringify(reaction) }
//     this.constantParams = Object.assign(this.constantParams, payload)
//     const urlParams = 'actions/' + postObject.actionId + '/reactions?'
//     super.post(urlParams)
//   }
// }
