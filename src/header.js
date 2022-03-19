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
  /**
   *
   * @param {*} head
   * @returns
   */
  getPrimaryKeyIndex(head) {
    return Object.values(head)
      .filter((value) => value.pk)
      .map((value) => value.idx)
  }

  getPrimaryKey(primeryKeyIndex, rowValues = []) {
    return new Hash(
      primeryKeyIndex
        .map((keyIndex) => {
          const value = rowValues[keyIndex]
          if (value instanceof Date) {
            return new Date(value).valueOf()
          } else {
            return value
          }
        })
        .join('')
    ).md5
  }

  getNotNullIndex(head) {
    return Object.values(head)
      .filter((value) => value.notNull)
      .map((value) => value.idx)
  }
}
