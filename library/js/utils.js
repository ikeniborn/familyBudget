class Hash {
  /**
   * Формирование хэш строки
   * @param {string} string
   */
  constructor(string) {
    this.string = typeof string === 'string' ? string : string + ''
  }

  /**
   * Hash MD5 in lowercase string
   */
  get md5() {
    let hexstr = ''
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      this.string
        .toLowerCase()
        .toString()
        .replace(/[$+\s+]/g, '_')
        .trim()
    )
    for (let i = 0; i < digest.length; i++) {
      var val = (digest[i] + 256) % 256
      hexstr += ('0' + val.toString(16)).slice(-2)
    }
    return hexstr
  }
}
