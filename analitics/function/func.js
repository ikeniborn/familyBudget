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
  menu.addItem('Calculate coefficient', 'calculateCoef')
  menu.addToUi()
}

function updateDotAtom() {
  updateHistory('2022-03-03', '2022-07-01', 'dot', 'atom', 'polkadot', 'cosmos')
}

function updateSdnBoba() {
  updateHistory(
    '2022-04-01',
    '2022-07-05',
    'sdn',
    'boba',
    'shiden',
    'boba-network'
  )
}
function updateEthBtc() {
  updateHistory('2021-05-02', '2022-07-06', 'eth', 'btc', 'ethereum', 'bitcoin')
}

function updateAtomEvmos() {
  updateHistory('2022-06-07', '2022-07-05', 'atom', 'evmos', 'cosmos', 'evmos')
}
