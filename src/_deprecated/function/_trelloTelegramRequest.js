function sendMessageTelegram(postObject) {
  try {
    const data = {
      method: 'post',
      payload: {
        method: 'sendMessage',
        chat_id: postObject.telegramChatId,
        text: postObject.telegramMessage,
        parse_mode: 'HTML'
      }
    }
    UrlFetchApp.fetch(postObject.telegramUrl, data);
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}