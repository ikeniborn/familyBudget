/**
 * API client for backend communication.
 *
 * Handles all HTTP requests to backend with JWT authentication.
 *
 * Usage:
 *   const api = new APIClient(auth);
 *   const facts = await api.listFacts({ date_from: '2025-10-01', limit: 20 });
 */

class APIClient {
  /**
   * @param {Auth} auth - Auth instance
   */
  constructor(auth) {
    this.auth = auth;
    this.baseURL = window.location.origin;
  }

  /**
   * Make authenticated HTTP request.
   *
   * @param {string} endpoint - API endpoint (e.g., '/facts', '/articles')
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Response data
   * @throws {APIError} On HTTP error
   */
  async request(endpoint, options = {}) {
    // Use existing /api/v1/* endpoints (no duplication)
    const url = `${this.baseURL}/api/v1${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add JWT token if authenticated
    const token = this.auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle error responses
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new APIError(response.status, error.detail || error.message);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      return await response.json();

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(0, `Network error: ${error.message}`);
    }
  }

  // ==================== Facts Endpoints ====================

  /**
   * List facts (transactions) with filters.
   *
   * @param {Object} params - Query parameters
   * @param {string} params.date_from - Start date (YYYY-MM-DD)
   * @param {string} params.date_to - End date (YYYY-MM-DD)
   * @param {string} params.type - Transaction type (fact/plan)
   * @param {number} params.category_id - Category ID filter
   * @param {number} params.limit - Page size (default 20)
   * @param {number} params.offset - Page offset
   * @returns {Promise<{facts: Array, total: number}>}
   */
  async listFacts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/facts?${query}`);
  }

  /**
   * Create fact (transaction).
   *
   * @param {Object} data - Fact data
   * @param {number} data.article_id - Category ID
   * @param {number} data.amount - Amount (positive for income, negative for expense)
   * @param {string} data.date - Transaction date (YYYY-MM-DD)
   * @param {string} data.description - Description (optional)
   * @param {string} data.record_type - Record type ('fact' or 'plan')
   * @returns {Promise<Object>} Created fact
   */
  async createFact(data) {
    return this.request('/facts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update fact (transaction).
   *
   * @param {number} id - Fact ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated fact
   */
  async updateFact(id, data) {
    return this.request(`/facts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete fact (transaction).
   *
   * @param {number} id - Fact ID
   * @returns {Promise<void>}
   */
  async deleteFact(id) {
    return this.request(`/facts/${id}`, {
      method: 'DELETE'
    });
  }

  // ==================== Articles Endpoints ====================

  /**
   * List articles (categories).
   *
   * @param {Object} params - Query parameters
   * @param {string} params.type - Category type (expense/income)
   * @param {boolean} params.is_current - Only current versions (default true)
   * @returns {Promise<{articles: Array}>}
   */
  async listArticles(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/articles?${query}`);
  }

  // ==================== Stats Endpoints ====================

  /**
   * Get aggregated summary statistics.
   *
   * @param {string} period - Period (today/week/month/year)
   * @returns {Promise<Object>} Summary stats
   */
  async getStatsSummary(period) {
    return this.request(`/stats/summary?period=${period}`);
  }

  /**
   * Get statistics by category.
   *
   * @param {string} period - Period
   * @param {string} type - Transaction type (expense/income)
   * @returns {Promise<Object>} Category stats
   */
  async getStatsByCategory(period, type) {
    return this.request(`/stats/by-category?period=${period}&type=${type}`);
  }

  /**
   * Get daily statistics.
   *
   * @param {string} period - Period
   * @returns {Promise<Object>} Daily stats
   */
  async getStatsByDay(period) {
    return this.request(`/stats/by-day?period=${period}`);
  }
}

/**
 * API Error class.
 */
class APIError extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} detail - Error detail message
   */
  constructor(status, detail) {
    super(detail);
    this.name = 'APIError';
    this.status = status;
    this.detail = detail;
  }
}
