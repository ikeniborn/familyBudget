import { Methods } from './fetch'

class Telegram {
  /**
   * Init trello api instance
   * @param {string} token
   */
  constructor(token = '') {
    if (Telegram.exists) {
      return Telegram.instance
    }
    Telegram.instance = this
    Telegram.exists = true
    this.https = 'https://api.telegram.org/' + token + '/'
    this.permanentParams = {}
    apiLib.newApi(this.https, this.permanentParams)
  }
}

class TelegrammApi {
  constructor(apiParametrs) {
    this.url = apiParametrs.url
    this.botId = apiParametrs.botId
    this.token = apiParametrs.token
  }
  fetchMethod(data) {
    const responce = UrlFetchApp.fetch(
      this.url + this.botId + ':' + this.token + '/',
      data
    )
    return JSON.parse(responce)
  }
}

class TelegrammMethod extends TelegrammApi {
  constructor(apiParametrs) {
    super(apiParametrs)
  }
  post(payload) {
    const data = {
      method: 'post',
      payload: payload,
    }
    return super.fetchMethod(data)
  }
}

class Chat {
  constructor(chatId) {
    this.chatId = chatId
    this.messageId = ''
  }
  getnfo() {
    const payload = {
      method: 'getChat',
      chat_id: this.chatId,
    }
    return apiLib.post(payload)
  }
  // sendMessage(message) {
  //   const payload = {
  //     method: 'sendMessage',
  //     chat_id: this.chatId,
  //     text: message,
  //     parse_mode: 'HTML',
  //   }
  //   const fetchData = super.post(payload)
  //   this.messageId = fetchData.result.message_id
  // }
  // editMessage(message) {
  //   const payload = {
  //     method: 'editMessageText',
  //     message_id: this.messageId,
  //     chat_id: this.chatId,
  //     text: message,
  //     parse_mode: 'HTML',
  //   }
  //   return super.post(payload)
  // }
  // deleteMessage() {
  //   const payload = {
  //     method: 'deleteMessage',
  //     chat_id: this.chatId,
  //     message_id: this.messageId,
  //   }
  //   return super.post(payload)
  // }
  // addButton(question, button) {
  //   const payload = {
  //     method: 'sendMessage',
  //     chat_id: this.chatId,
  //     text: question,
  //     parse_mode: 'HTML',
  //     reply_markup: JSON.stringify({
  //       inline_keyboard: button,
  //     }),
  //   }
  //   const fetchData = super.post(payload)
  //   return fetchData
  // }
}
