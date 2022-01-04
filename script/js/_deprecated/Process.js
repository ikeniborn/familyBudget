
const APITRELLO = {
  url: 'https://api.trello.com/1/',
  key: '667e428a7777072d52159e071dda7b4f',
  token: '178e458be5a2f65e41dd36fa8ebf669af0addc8fd18ac5d84266e02f6df29269'
}

const APITELEGRAMM = {
  url: "https://api.telegram.org/bot",
  botId: '806168491',
  token: 'AAE5G1oPobTtfArA0vMOH88S9bqi1EfSrjs'
}

const DATABASE = {
  sheetId: '12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ'
}

const REPORT = {
  sheetId: '1mBsaVLbKLoIXN2WY9Oi-XBPbViwbCt29gozLkOL5sLc'
}

const webAppUrl = 'https://script.google.com/macros/s/AKfycbzK1-SxtMY1pFcwK2f-xuTl9H5-CRiTXxp7-v8tMhdxKqn0GG4n7DvTT9kaTvEMZRJ3JQ/exec'

function test() {
  const budgetBoard = new TrelloBoard(APITRELLO, '5e205c1e08b1ce8bac5a28e6')
  const budgetList = new TrelloList(APITRELLO, '60bfc2324325de48c879a233')
  const card = new TrelloCard(APITRELLO, "606191e1b260d729cade78ae")
  // const testlist = budgetBoard.addList('TEST3')
  // const testcard = testlist.addCard('test3',1,budgetBoard.getLabel('red').id)
  // Logger.log(budgetBoard.getLabel('red'))
  // Logger.log(budgetList.getCards())
  // Logger.log(card.label)
  // const myChat = new TelegrammChat(APITELEGRAMM, '740775802')
  // myChat.sendMessage('testOld')
  // myChat.editMessage('testNew')
  // myChat.deleteMessage()
  // Logger.log(myChat.messageId)
  // Logger.log(messageRequist.date)
  // Logger.log(messageRequist)
  // SpreadsheetApp.openById('1mBsaVLbKLoIXN2WY9Oi-XBPbViwbCt29gozLkOL5sLc')
  // const url = 'https://script.googleapis.com/v1/projects/14oUhVGPwUhlSdEgBekYNCUZCbkk9lwjaKxFIurm-ESqeFRvXzzTvNMRw/deployments'
  // const ws = new GoogleSpreadsheet('12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ').open().getSheetByName('t_d_accounting_item')
  const dt = new FormatDate() 
  // const fct = new GoogleTable(DATABASE,"t_f_trello")
  // const ck = new Check()
  Logger.log(dt.getPreviousDate(50))
}


function setWebhook() {
  const url = APITELEGRAMM.url + APITELEGRAMM.botId + ':' + APITELEGRAMM.token + '/setWebhook?url=' + webAppUrl;
  const response = UrlFetchApp.fetch(url);
  Logger.log(response)
}

function doPost(e) {
  const myChat = new InlineKeyboard(APITELEGRAMM, '740775802')
  // Logger.log(JSON.parse(e.postData.contents))
  myChat.addButton('qqq')
}