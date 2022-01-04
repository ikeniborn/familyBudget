

class TelegrammApi {
  constructor(apiParametrs) {
    this.url = apiParametrs.url
    this.botId = apiParametrs.botId
    this.token = apiParametrs.token
  }
  fetchMethod(data) {
    const responce = UrlFetchApp.fetch(this.url + this.botId + ':' + this.token + '/', data)
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
      payload: payload
    }
    return super.fetchMethod(data)
  }
}

class TelegrammChat extends TelegrammMethod {
  constructor(apiParametrs, chatId) {
    super(apiParametrs)
    this.chatId = chatId
    this.messageId = ''
  }
  get info() {
    const payload = {
      method: 'getChat',
      chat_id: this.chatId
    }
    return super.post(payload)
  }
  sendMessage(message) {
    const payload = {
      method: 'sendMessage',
      chat_id: this.chatId,
      text: message,
      parse_mode: 'HTML'
    }
    const fetchData = super.post(payload)
    this.messageId = fetchData.result.message_id
  }
  editMessage(message) {
    const payload = {
      method: 'editMessageText',
      message_id: this.messageId,
      chat_id: this.chatId,
      text: message,
      parse_mode: 'HTML'
    }
    return super.post(payload)
  }
  deleteMessage() {
    const payload = {
      method: 'deleteMessage',
      chat_id: this.chatId,
      message_id: this.messageId
    }
    return super.post(payload)
  }
  addButton(question, button) {
    const payload = {
      method: 'sendMessage',
      chat_id: this.chatId,
      text: question,
      parse_mode: 'HTML',
      reply_markup: JSON.stringify({
        inline_keyboard: button
      })
    }
    const fetchData = super.post(payload)
    return fetchData
  }
}




