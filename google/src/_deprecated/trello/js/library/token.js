/**
 *
 * @param {*} fields
 * @param {*} webhooks
 * @returns {object}
 */
function tokenGet(fields, webhooks) {
  return new Token().get(fields, webhooks)
}

/**
 *
 *
 * @param {string} fields
 * @returns {object}
 */
function tokenGetMember(fields) {
  return new Token().getMember(fields)
}

/**
 * Retrieve all webhooks created with a Token.
 *
 * @returns {array} Array Webhook
 */
function tokenGetWebHooks() {
  return new TrelloToken().getWebHooksForToken()
}

/**
 * Create a new webhook for a Token.
 *
 * @param {string} callbackURL The URL that the webhook should POST information to. Format: url
 * @param {string} idModel ID of the object to create a webhook on. Pattern: ^[0-9a-fA-F]{24}$
 * @param {string} description A description to be displayed when retrieving information about the webhook.
 * @returns {object} Webhook
 */
function tokenCreateWebhook(callbackURL, idModel, description) {
  return new Token().createWebhook(callbackURL, idModel, description)
}
