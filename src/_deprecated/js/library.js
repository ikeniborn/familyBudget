/**
 * Initialization new API
 * @param {string} permanentUrl Permanent URL part
 * @param {object} permanentPath Permanent path parametr for URL
 * @param {object} permanentQuery Permanent query parametr
 *  @param {object} permanentData Permanent data in fetch
 * @returns {apiLib}
 */
function newApi(
  permanentUrl,
  permanentPath = {},
  permanentQuery = {},
  permanentData = {}
) {
  return new Api(permanentUrl, {
    path: permanentPath,
    query: permanentQuery,
    data: permanentData,
  })
}

/**
 *
 * @param {string} methodName Type of fetch method: post, get, put,delete
 * @param {string} variableUrl Variable part of URL
 * @param {object} variablePath Variable path parametr of URL
 * @param {object} variableQuery Variable query parametr of URL
 * @param {object} variableData Variable data in fetch
 * @returns Response data from fetch
 */
function method(
  methodName = 'post',
  variableUrl = '',
  variablePath = {},
  variableQuery = {},
  variableData = {}
) {
  const methods = new Methods({
    url: variableUrl,
    path: variablePath,
    query: variableQuery,
    data: variableData,
  })
  methodName = methodName.toLowerCase().trim()
  if (methodName === 'post') {
    return methods.post()
  } else if (methodName === 'get') {
    return methods.get()
  } else if (methodName === 'put') {
    return methods.put()
  } else if (methodName === 'delete') {
    return methods.del()
  }
}
