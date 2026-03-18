/**
 * P2PRelayService - Relay API calls for P2P sync.
 *
 * Extracted from P2PUIController.js to separate network I/O from UI logic.
 *
 * @version 1.0.0
 */

/**
 * Create a relay offer (POST /api/v1/p2p/relay).
 * @param {string} payload - Encoded relay payload
 * @returns {Promise<{code: string}>} Parsed JSON response with relay code
 * @throws {Error} On non-OK response
 */
export async function createRelayOffer(payload) {
  const res = await fetch('/api/v1/p2p/relay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('Сервер недоступен (' + res.status + ')');
  return await res.json();
}

/**
 * Get a relay offer by code (GET /api/v1/p2p/relay/{code}).
 * @param {string} code - 6-character relay code
 * @returns {Promise<{payload: string}>} Parsed JSON response with offer payload
 * @throws {Error} On non-OK response or 404 (code not found)
 */
export async function getRelayOffer(code) {
  const res = await fetch(`/api/v1/p2p/relay/${code}`);
  if (res.status === 404) {
    const err = new Error('Код не найден или истёк срок');
    err.notFound = true;
    throw err;
  }
  if (!res.ok) throw new Error('Ошибка сервера (' + res.status + ')');
  return await res.json();
}

/**
 * Post a relay answer (POST /api/v1/p2p/relay/{code}/answer).
 * @param {string} code - 6-character relay code
 * @param {string} payload - Encoded relay answer payload
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} On non-OK response
 */
export async function postRelayAnswer(code, payload) {
  const res = await fetch(`/api/v1/p2p/relay/${code}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('Не удалось отправить ответ (' + res.status + ')');
  return await res.json();
}

/**
 * Poll for a relay answer (GET /api/v1/p2p/relay/{code}/answer).
 * @param {string} code - 6-character relay code
 * @returns {Promise<{status: number, data: Object|null}>}
 *   - status 200: answer available, data contains {payload}
 *   - status 202: still waiting, data is null
 *   - status 404: code expired, data is null
 */
export async function pollRelayAnswer(code) {
  const res = await fetch(`/api/v1/p2p/relay/${code}/answer`);
  if (res.status === 200) {
    const data = await res.json();
    return { status: 200, data };
  }
  return { status: res.status, data: null };
}
