import { Hash } from './utils'
export { Header }

class Header {
  /**
   * Get head alias
   * @param {object} head Header object
   * @returns {array}
   */
  getHeaderAlias(head) {
    return Object.values(head).map((m) => m.alias)
  }

  getHead(workSheetHeads, sheetName) {
    const head = Object.entries(workSheetHeads).reduce(
      (object, [key, value]) => {
        if (!object[new Hash(key).md5]) {
          object[new Hash(key).md5] = value
        }
        return object
      },
      {}
    )
    return head[new Hash(sheetName).md5]
  }

  getPrimaryKey(head = {}, rowObject = {}) {
    return new Hash(
      Object.keys(head)
        .filter((column) => head[column].pk)
        .map((column) => {
          const value = rowObject[column]
          if (value instanceof Date) {
            return new Date(value).valueOf()
          } else {
            return value
          }
        })
        .join('')
    ).md5
  }

  isChangePrimaryKey(head, rowObject = {}) {
    return Object.keys(head)
      .filter((column) => head[column].pk)
      .some((column) => (rowObject[column] ? true : false))
  }

  isNotNull(head, rowObject = {}) {
    const data = Object.keys(head).filter((column) => head[column].notNull)
    if (data.length) {
      return data.every((column) => rowObject[column])
    }
    return false
  }
}
