import { Methods } from './fetch'
export { GasProcess }
/**
 * CryptoCompare instance
 */
class Instance {
  /**
   * Create new inctance API CryptoCompare
   *
   */
  constructor() {
    if (Instance.exists) {
      return Instance.instance
    }
    Instance.instance = this
    Instance.exists = true
    this.methods = new Methods({
      domain: 'https://script.googleapis.com/v1',
      data: {
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
          accept: 'application/json',
        },
        muteHttpExceptions: false,
      },
    })
  }
}

class GasProcess {
  constructor() {
    this.methods = new Instance().methods
  }

  getRunningProcesses() {
    try {
      return this.methods.get({
        endPoint: '/processes:listScriptProcesses',
        query: {
          scriptId: ScriptApp.getScriptId(),
          ['scriptProcessFilter.statuses']: 'RUNNING',
        },
      })
    } catch (error) {
      console.error('GASProcess.getRunningProcess', error)
    }
  }
}

// class GasScript {
//   constructor(parametr) {
//     this.parametr = parametr + ': '
//     this.startDate = new Date()
//   }
//   getLastProjectVersion() {
//     const url =
//       'https://script.googleapis.com/v1/projects/' +
//       ScriptApp.getScriptId() +
//       '/versions'

//     const res = UrlFetchApp.fetch(url, {
//       headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
//     })
//     return Math.max(JSON.parse(res).versions.map((m) => (m = m.versionNumber)))
//   }

//   getListScriptProcesses() {
//     const url =
//       'https://script.googleapis.com/v1/processes:listScriptProcesses?scriptId=' +
//       ScriptApp.getScriptId() +
//       '&scriptProcessFilter.statuses=RUNNING'
//     const res = UrlFetchApp.fetch(url, {
//       headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
//       accept: 'application/json',
//       muteHttpExceptions: false,
//     })
//     const processes = JSON.parse(res)?.processes || void 0
//     return processes
//   }
// }
