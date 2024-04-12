/**
 *
 * @param {*} callbackURL
 * @param {*} idModel
 * @param {*} active
 * @param {*} description
 * @returns
 */
function webhookCreate(callbackURL, idModel, active, description) {
  return new Webhook().create(callbackURL, idModel, active, description)
}

/**
 * Get a webhook by ID.
 * @param {string} id ID of the webhook to retrieve.
 */
function webhookGet(id) {
  new Webhook().get(id)
}

/**
 * Update a webhook by ID.
 * @param {string} id ID of the webhook to retrieve. Pattern: ^[0-9a-fA-F]{24}$
 * @param {string} callbackURL A valid URL that is reachable with a HEAD and POST request. Format: url
 * @param {string} idModel ID of the model to be monitored
 * @param {boolean} active Determines whether the webhook is active and sending POST requests.
 * @param {string} description A string with a length from 0 to 16384.
 */
function webhookUpdate(id, callbackURL, idModel, active, description) {
  return new Webhook().update(id, callbackURL, idModel, active, description)
}

/**
 * Delete a webhook by ID.
 * @param {string} id ID of the webhook to retrieve. Pattern: ^[0-9a-fA-F]{24}$
 * @returns {object}
 */
function webhookDelete(id) {
  return new Webhook().delete(id)
}

/**
 * Get a field on a Webhook.
 *
 * @param {string} id ID of the webhook. Pattern: ^[0-9a-fA-F]{24}$
 * @param {string} field Field to retrieve. Valid values: active, callbackURL, description, idModel, consecutiveFailures, firstConsecutiveFailDate
 * @returns {object}
 */
function webhookGetFields(id, field) {
  return new Webhook().getFields(id, field)
}
