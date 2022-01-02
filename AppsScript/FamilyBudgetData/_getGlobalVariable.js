function getGlobalVariable() {
  try {
    // variables trelloApi
    const apiKey = '667e428a7777072d52159e071dda7b4f'
    const apiToken = '178e458be5a2f65e41dd36fa8ebf669af0addc8fd18ac5d84266e02f6df29269'
    const variable = {}
    variable.keyAndToken = 'key=' + apiKey + '&token=' + apiToken
    variable.apiRoot = 'https://api.trello.com/1/'
    variable.lineBreak = '%0A'
    // variables telegramApi
    const telegramToken = '806168491:AAE5G1oPobTtfArA0vMOH88S9bqi1EfSrjs'
    variable.telegramUrl = "https://api.telegram.org/bot" + telegramToken + '/'
    variable.telegramChatId = ['740775802', '491950657']
    variable.telegramLineBreak = '\n'
    // board id
    variable.boardIdFact0 = '5e33ed07a1f5503ead51b63a'
    variable.boardIdFact = '5e05161dc3abef51fcf4e761'
    variable.boardIdBudget = '5e205c1e08b1ce8bac5a28e6'
    variable.boardIdBudget2 = '5e33ebf6e535dd19af746f72'
    variable.boardIdBudget3 = '5e33ed63d17a353274f570ce'
    variable.boardIdTarget = '5e3cec63b47787407b262e0b'
    // списко книг
    variable.sourceSheetID = '12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ'
    variable.targetSheetID = '1mBsaVLbKLoIXN2WY9Oi-XBPbViwbCt29gozLkOL5sLc'
    // список листов
    variable.accountingItemSheetName = 't_d_accounting_item'
    variable.costСenterSheetName = 't_d_cost_center'
    variable.financialCenterSheetName = 't_d_financial_center'
    variable.parametrSheetName = 't_d_period'
    variable.goalsSheetName = 't_d_goal'
    variable.sourceSheetNameTrello = 't_f_trello'
    variable.sourceSheetNameLog = 't_f_log'
    variable.sourceSheetNameError = 't_f_error'
    variable.targetSheetNameAccount = 'Учет'
    variable.targetSheetNameTarget = 'Цели'
    // реакции трелло
    variable.sunglasses = {
      'unified': '1F60E',
      'native': '😎',
      'shortName': 'sunglasses'
    }
    variable.buuReaction = {
      "unified": "1F60D",
      "native": "😍",
      "shortName": "heart_eyes"
    }
    variable.moneyBag = {
      "unified": "1F4B0",
      "native": "💰",
      "shortName": "moneybag"
    }
    variable.scream = {
      "unified": "1F631",
      "native": "😱",
      "shortName": "scream"
    }
    return variable
  } catch (e) {
    console.error(arguments.callee.name + ': ' + e)
  }
}

//function getTelegramApiToken() {
//  var token = '806168491:AAE5G1oPobTtfArA0vMOH88S9bqi1EfSrjs'
//  return token
//}
//
//function  getTrelloApiKey() {
//  // ilya - 9dae7dd3ce328d61e67edb4557149502
//  // ikenibot - 667e428a7777072d52159e071dda7b4f
//  var apiKey = '667e428a7777072d52159e071dda7b4f'
//   return apiKey
//}
//
//function getTrelloApiToken() {
//  // ilya - e47e9f1e751ede79d8357bee26cbf3bd9d1958481b6d05a241f8687afc63f4cf
//  // ikenibot - 178e458be5a2f65e41dd36fa8ebf669af0addc8fd18ac5d84266e02f6df29269
//  var apiToken = '178e458be5a2f65e41dd36fa8ebf669af0addc8fd18ac5d84266e02f6df29269'
//  return apiToken
//}
//
//// webHookId for fact data
//var trelloWebHookIdFact = '5e2741122821b4519bff5ca0'
//var trelloWebHookIdBudget = '5e2741395de3bb783af44d11'