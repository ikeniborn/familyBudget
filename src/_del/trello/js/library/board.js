/**
 * Request a single board.
 *
 * @param {string} id Id board
 * @returns {object}
 */
function boardGet(id) {
  return new Board(id).get()
}

/**
 * Create a new Label on a Board.
 *
 * @param {string} id Id board
 * @param {string} name Name label
 * @param {string} color Color label. Valid values: yellow, purple, blue, red, green, orange, black, sky, pink, lime
 * @returns {object}
 */
function boardAddLabel(id, name, color) {
  return new Board(id).addLabel(name, color)
}

/**
 * Get label with color
 *
 * @param {string} id Id board
 * @param {string} color Color label. Valid values: yellow, purple, blue, red, green, orange, black, sky, pink, lime
 * @returns {string} Id label
 */
function boardGetLabel(id, color) {
  return new Board(id).addLabel(color)
}

/**
 * Update name board
 *
 * @param {string} id Id board
 * @param {string} name Name board
 */
function boardUpdateName(id, name) {
  new Board(id).updateName(name)
}

/**
 * Get lists of board
 *
 * @param {string} id Id board
 * @returns {array} Array of lists
 */
function boardGetLists(id) {
  return new Board(id).getLists()
}

/**
 * Add list to board
 *
 * @param {string} id Id board
 * @param {string} name Name list
 */
function boardAddList(id, name) {
  new Board(id).addList(name)
}
