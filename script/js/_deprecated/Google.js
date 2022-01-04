class GoogleDatabase {
  constructor(googleDatabase) {
    this.sheetId = googleDatabase.sheetId
  }
  open() {
    return SpreadsheetApp.openById(this.sheetId)
  }
}

class GoogleTable extends GoogleDatabase {
  constructor(googleDatabase, table) {
    super(googleDatabase)
    this.table = table
  }
  open() {
    return super.open().getSheetByName(this.table)
  }
  getValues(){
    return this.open().getDataRange().getValues()
  }
  appendRow(array){
    this.open().appendRow(array)
  }
}