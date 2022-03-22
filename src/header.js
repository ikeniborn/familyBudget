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

  getPrimaryKey(head = {}, rowValues = {}) {
    return new Hash(
      Object.keys(head)
        .filter((column) => head[column].pk)
        .map((column) => {
          const value = rowValues[column]
          if (value instanceof Date) {
            return new Date(value).valueOf()
          } else {
            return value
          }
        })
        .join('')
    ).md5
  }

  isNotNull(head, rowValues = {}) {
    return Object.keys(head)
      .filter((column) => head[column].notNull)
      .every((column) => (rowValues[column] ? true : false))
  }
}
