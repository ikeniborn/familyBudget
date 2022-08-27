export { Methods }

class Methods {
  constructor(
    permanentParams = {
      domain: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addPermanentParams(permanentParams)
  }

  addPermanentParams(permanentParams) {
    this.domain = permanentParams.domain
    delete permanentParams?.domain
    this.params = permanentParams
  }

  addVariableParams(variableParams) {
    this.url = this.domain + (variableParams?.endPoint || '')
    delete variableParams?.endPoint
    Object.entries(variableParams).forEach((param) => {
      if (!this.params[param[0]]) {
        this.params[param[0]] = param[1]
      } else {
        Object.entries(param[1]).forEach((subParams) => {
          if (!this.params[param[0]][subParams[0]]) {
            this.params[param[0]][subParams[0]] = subParams[1]
          } else {
            //* re-write permanent parametrs
            this.params[param[0]][subParams[0]] = subParams[1]
          }
        })
      }
    })
  }

  post(
    variableParams = {
      endPoint: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addVariableParams(variableParams)
    this.params.data.method = 'post'
    return new Fetch(this.url, this.params).fetch()
  }

  put(
    variableParams = {
      endPoint: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addVariableParams(variableParams)
    this.params.data.method = 'put'
    return new Fetch(this.url, this.params).fetch()
  }

  get(
    variableParams = {
      endPoint: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addVariableParams(variableParams)
    this.params.data.method = 'get'
    return new Fetch(this.url, this.params).fetch()
  }

  del(
    variableParams = {
      endPoint: '',
      path: {},
      query: {},
      data: {},
    }
  ) {
    this.addVariableParams(variableParams)
    this.params.data.method = 'delete'
    return new Fetch(this.url, this.params).fetch()
  }
}

class Fetch {
  /**
   * Create url and send fetch
   *
   * @param {string} url domain url
   * @param {object} params parametrs { path: {}, query: {}, data: {} }
   */
  constructor(url, params = { path: {}, query: {}, data: {} }) {
    this.result = ''
    this.getParametr(params)
    this.createUrl(url)
  }

  getParametr(params) {
    const pMap = new Map(Object.entries(params))
    !pMap.has('path') ? (this.path = {}) : (this.path = pMap.get('path'))
    !pMap.has('query') ? (this.query = {}) : (this.query = pMap.get('query'))
    !pMap.has('data') ? (this.data = {}) : (this.data = pMap.get('data'))
  }

  createPathParametrs(url, path) {
    return url.replace(
      new RegExp('{([^{]+)}', 'g'),
      function (_unused, varName) {
        return path[varName]
      }
    )
  }

  createQueryParametrs(query) {
    return Object.entries(query).reduce((queryString, query, index) => {
      if (query[1]) {
        if (!index) {
          queryString += '?' + query[0] + '=' + query[1]
        } else {
          queryString += '&' + query[0] + '=' + query[1]
        }
      }
      return queryString
    }, '')
  }

  createUrl(url) {
    this.url =
      this.createPathParametrs(url, this.path) +
      this.createQueryParametrs(this.query)
  }
  /**
   * Send fetch
   * @param {object} data fetch parametr
   * @returns {object} Responce data from fetch
   */
  fetch() {
    try {
      // const fetchPromise = (result = {}) => {
      //   return new Promise((resolve, reject) => {
      //     const response = UrlFetchApp.fetch(this.url, this.data)
      //     result.code = response.getResponseCode()
      //     if (result.code === 200) {
      //       this.result = JSON.parse(response.getContentText())
      //       result.fetchStatus = true
      //       resolve(result)
      //     } else {
      //       reject(result)
      //     }
      //   })
      // }
      // const timeOutPromise = (result) => {
      //   return new Promise((resolve) => {
      //     console.log('URL: ' + this.url)
      //     console.log('Response code: ' + code)
      //     console.log('Start timeout: ' + this.ms / 1000 + ' sec')
      //     Utilities.sleep(this.ms)
      //     result.ms += 250
      //     result.iteration += 1
      //     if (result.iteration > 5) {
      //       result.fetchStatus = true
      //     }
      //     resolve(result)
      //   })
      // }

      const stepResult = {
        code: 0,
        fetchStatus: false,
        ms: 250,
        iteration: 0,
        response: void 0,
      }
      do {
        const response = UrlFetchApp.fetch(this.url, this.data)
        stepResult.code = response.getResponseCode()
        if (stepResult.code === 200) {
          // console.log('URL: ' + this.url, 'Response code: ' + stepResult.code)
          stepResult.response = JSON.parse(response.getContentText())
          stepResult.fetchStatus = true
        } else {
          console.log(
            'URL: ' + this.url,
            'Response code: ' + stepResult.code,
            'Responce: ' + response,
            'Iteration: ' + stepResult.iteration,
            'Start timeout: ' + stepResult.ms / 1000 + ' sec'
          )
          stepResult.iteration += 1
          stepResult.ms += 500
          Utilities.sleep(stepResult.ms)
        }
        if (stepResult.iteration > 5) {
          stepResult.fetchStatus = true
        }
      } while (!stepResult.fetchStatus)

      return stepResult.response
    } catch (error) {
      console.error(error)
    }
  }
}
