function updateCoef() {
  calculateCoef('2022-04-01', '2022-07-10', 'cosmos', 'evmos')
}

function updateDotAtom() {
  updateHistory('2021-09-15', '2022-07-07', 'polkadot', 'cosmos')
}

function updateSdnBoba() {
  updateHistory('2022-01-01', '2022-07-09', 'shiden', 'boba-network')
}
function updateEthBtc() {
  updateHistory('2021-05-02', '2022-07-06', 'ethereum', 'bitcoin')
}

function updateAtomEvmos() {
  updateHistory('2022-06-07', '2022-07-05', 'cosmos', 'evmos')
}

function createMenu() {
  const ui = SpreadsheetApp.getUi()
  const menu = ui.createMenu('Analitics')
  menu.addSubMenu(
    SpreadsheetApp.getUi()
      .createMenu('Update')
      .addItem('updateDotAtom', 'updateDotAtom')
      .addItem('updateSdnBoba', 'updateSdnBoba')
      .addItem('updateEthBtc', 'updateEthBtc')
      .addItem('updateAtomEvmos', 'updateAtomEvmos')
  )
  menu.addItem('Calculate coefficient', 'updateCoef')
  menu.addToUi()
}
