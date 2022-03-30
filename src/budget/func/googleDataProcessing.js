function updateAccountData() {
  try {
    const object = getGlobalVariable()
    const trelloOpen = openGoogleSheet(object.sourceSheetID, object.sourceSheetNameTrello)
    const accountOpen = openGoogleSheet(object.targetSheetID, object.targetSheetNameAccount)
    const currentDate = new Date()
    const startPeriodFact = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
    const startPeriodBudget = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    const endPeriod = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const trelloArray = getGoogleSheetValues(trelloOpen)
    const filterArray = trelloArray.reduce(function (row, array, index) {
      if (index != 0) {
        const object = {}
        //* данные из буфера трелло
        object.actionDate = array[0]
        object.period = array[1]
        object.cfo = array[2]
        object.mvz = array[3]
        object.cashFlow = array[4]
        object.bill = array[5]
        object.account = array[6]
        object.nomenclature = array[7]
        object.sum = array[8]
        object.comment = array[9]
        object.actionId = array[10]
        object.type = array[11]
        object.indexRow = index + 1
        if (isMatch(object.type, 'факт') && new Date(object.period) >= startPeriodFact && new Date(object.period) <= endPeriod || isMatch(object.type, 'бюджет') && new Date(object.period) >= startPeriodBudget && new Date(object.period) <= endPeriod) {
          //* Преобразование объектов в массив
          const sheetRow = [object.actionDate, object.period, object.cfo, object.mvz, object.cashFlow, object.bill, object.account, object.nomenclature, object.sum, object.comment, object.actionId, object.type]
          row.push(sheetRow)
        }
      }
      return row
    }, [])
    if (accountOpen.getMaxRows() !== 1) {
      accountOpen.deleteRows(2, accountOpen.getMaxRows() - 1)
    }
    //* Опредление диапазона и вставка данных
    accountOpen.getRange(accountOpen.getLastRow() + 1, 1, filterArray.length, filterArray[0].length).setValues(filterArray)
  } catch (e) {
    addErrorItem(arguments.callee.name + ': ' + e)
  }
}

function MD5(input) {
  var txtHash = '';
  var rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    input);
  for (i = 0; i < rawHash.length; i++) {

    var hashVal = rawHash[i];

    if (hashVal < 0) {
      hashVal += 256;
    };
    if (hashVal.toString(16).length == 1) {
      txtHash += '0';
    };
    txtHash += hashVal.toString(16);
  };

  // change below to "txtHash.toUpperCase()" if needed
  return txtHash;

}