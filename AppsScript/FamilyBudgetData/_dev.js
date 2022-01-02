function testDev() {
  try {
    //const object = Object.assign({}, getGlobalVariable())
    //object.cardDescription='54545'
    //sendMessageTelegram1(object)
    //object.cfo = 'Илья'
    //object.comment = 'перфоратор, поддон для душа, стройматериалы гараж'
    ////    // открытие листов
    ////    postObject.financialCenterSheetOpen = openGoogleSheet(postObject.sourceSheetID, postObject.financialCenterSheetName)
    ////    postObject.accountingItemSheetOpen = openGoogleSheet(postObject.object, postObject.accountingItemSheetName)
    //    object.costСenterSheetOpen = openGoogleSheet(object.sourceSheetID, object.costСenterSheetName)
    //    object.parametrSheetOpen = openGoogleSheet(object.sourceSheetID, object.parametrSheetName)
    ////    postObject.goalsSheetOpen = openGoogleSheet(postObject.sourceSheetID, postObject.goalsSheetName)
    ////    postObject.trelloOpen = openGoogleSheet(postObject.sourceSheetID, postObject.sourceSheetNameTrello)
    ////    postObject.errorOpen = openGoogleSheet(postObject.sourceSheetID, postObject.sourceSheetNameError)
    ////    postObject.logOpen = openGoogleSheet(postObject.sourceSheetID, postObject.sourceSheetNameLog)
    ////    postObject.accountOpen = openGoogleSheet(postObject.targetSheetID, postObject.targetSheetNameAccount)
    ////    postObject.targetOpen = openGoogleSheet(postObject.targetSheetID, postObject.targetSheetNameTarget)
    ////    // данные с листов
    ////    postObject.financialСenterArray = getGoogleSheetValues(postObject.financialCenterSheetOpen)
    ////    postObject.accountingItemArray = getGoogleSheetValues(postObject.accountingItemSheetOpen)
    //    object.costСenterArray = getGoogleSheetValues(object.costСenterSheetOpen)
    //    object.parametrArray = getGoogleSheetValues(object.parametrSheetOpen)
    ////    postObject.goalsArray = getGoogleSheetValues(postObject.goalsSheetOpen)
    ////    postObject.trelloArray = getGoogleSheetValues(postObject.trelloOpen)
    ////    postObject.errorArray = getGoogleSheetValues(postObject.errorOpen)
    ////    postObject.accountArray = getGoogleSheetValues(postObject.accountOpen)
    ////    postObject.targetArray = getGoogleSheetValues(postObject.targetOpen)
    ////let d = new Date()
    ////Logger.log( getYMD1(d))
    ////    const object ={}
    //     const currDate =  getPeriod(object)
    //      object.period = new Date(currDate.getFullYear(), currDate.getMonth(), 1)
    //      object.ymd = getYMD(object.period)
    //      object.factPeriod2 = new Date(object.period.getFullYear(), object.period.getMonth() - 2, 1)
    //      object.factPeriod1 = new Date(object.period.getFullYear(), object.period.getMonth() - 1, 1)
    //      object.factPeriod = object.period
    //      object.budgetPeriod = new Date(object.period.getFullYear(), object.period.getMonth() + 1, 1)
    //      object.budgetPeriod2 = new Date(object.period.getFullYear(), object.period.getMonth() + 2, 1)
    //      object.budgetPeriod3 = new Date(object.period.getFullYear(), object.period.getMonth() + 3, 1)
    //       Logger.log(getCostСenter(object) )
    Logger.log(LibraryIdentifier.activateNewMember())
  } catch (e) {
    Logger.log(arguments.callee.name + ': ' + e)
  }
}

function uploadSheetToBigQuery() {
  const projectId = 'homebudget-270904'
  // const upload 
}