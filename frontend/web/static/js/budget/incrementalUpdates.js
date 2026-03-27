/**
 * Incremental UI Updates Module
 *
 * Provides incremental DOM updates from WebSocket payload without HTTP requests.
 * Uses in-memory cache for reference data (articles, financial centers).
 * Falls back to HTMX refresh when cache is unavailable.
 *
 * @module IncrementalUpdates
 * @version 1.0.0
 *
 * Usage:
 *   // Initialize cache on page load
 *   await IncrementalUpdates.initCache();
 *
 *   // WebSocket handler
 *   window.budgetWSClient.on('fact_created', (data) => {
 *       IncrementalUpdates.onFactCreated(data);
 *   });
 */

(function() {
    'use strict';

    const IncrementalUpdates = {
        // ==================== REFERENCE DATA CACHE ====================

        _articlesMap: new Map(),      // article_id -> { name, type, ... }
        _financialCentersMap: new Map(), // fc_id -> { name, ... }
        _cacheInitialized: false,
        _cacheInitPromise: null,

        /**
         * Initialize reference data cache from API
         * Should be called once on page load
         * @returns {Promise<boolean>} - true if cache initialized successfully
         */
        async initCache() {
            // Return existing promise if initialization is in progress
            if (this._cacheInitPromise) {
                return this._cacheInitPromise;
            }

            this._cacheInitPromise = this._loadCacheData();
            return this._cacheInitPromise;
        },

        async _loadCacheData() {
            try {
                // Parallel fetch of articles and financial centers
                const [articlesRes, fcsRes] = await Promise.all([
                    fetch('/api/v1/articles?leaf_only=false'),
                    fetch('/api/v1/financial-centers?include_archived=false')
                ]);

                if (articlesRes.ok) {
                    const articlesData = await articlesRes.json();
                    const articles = Array.isArray(articlesData)
                        ? articlesData
                        : (articlesData.articles || []);

                    this._articlesMap.clear();
                    articles.forEach(article => {
                        this._articlesMap.set(article.id, {
                            name: article.name,
                            type: article.type // expense, income, debit, credit
                        });
                    });
                }

                if (fcsRes.ok) {
                    const fcsData = await fcsRes.json();
                    const fcs = Array.isArray(fcsData)
                        ? fcsData
                        : (fcsData.financial_centers || []);

                    this._financialCentersMap.clear();
                    fcs.forEach(fc => {
                        this._financialCentersMap.set(fc.id, {
                            name: fc.name
                        });
                    });
                }

                this._cacheInitialized = true;
                return true;
            } catch (error) {
                console.warn('[IncrementalUpdates] Cache init failed:', error);
                this._cacheInitialized = false;
                return false;
            }
        },

        /**
         * Get article from cache
         * @param {number} articleId
         * @returns {Object|null} - { name, type } or null
         */
        getArticle(articleId) {
            return this._articlesMap.get(articleId) || null;
        },

        /**
         * Get financial center from cache
         * @param {number} fcId
         * @returns {Object|null} - { name } or null
         */
        getFinancialCenter(fcId) {
            return this._financialCentersMap.get(fcId) || null;
        },

        // ==================== FORMATTING UTILITIES ====================

        /**
         * Format currency value with space separators (Russian locale)
         * @param {number} value
         * @returns {string}
         */
        formatCurrency(value) {
            return new Intl.NumberFormat('ru-RU', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);
        },

        /**
         * Format currency for mobile (abbreviated)
         * @param {number} value
         * @returns {string}
         */
        formatCurrencyMobile(value) {
            const abs = Math.abs(value);
            if (abs >= 1000000) {
                return (value / 1000000).toFixed(1) + 'M';
            } else if (abs >= 1000) {
                return (value / 1000).toFixed(1) + 'k';
            }
            return value.toFixed(0);
        },

        /**
         * Format date as DD.MM.YYYY
         * @param {string|Date} dateStr
         * @returns {string}
         */
        formatDateFull(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        },

        /**
         * Format date as DD.MM
         * @param {string|Date} dateStr
         * @returns {string}
         */
        formatDateShort(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit'
            });
        },

        /**
         * Get CSS class for amount color based on article type
         * @param {string} articleType - expense, income, debit, credit
         * @returns {string}
         */
        getAmountColorClass(articleType) {
            switch (articleType) {
                case 'income':
                case 'credit':
                    return 'text-success';
                case 'expense':
                case 'debit':
                    return 'text-error';
                default:
                    return '';
            }
        },

        /**
         * Format money with sign based on article type
         * @param {number} amount
         * @param {string} articleType
         * @returns {string}
         */
        formatMoneyWithSign(amount, articleType) {
            const sign = (articleType === 'income' || articleType === 'credit') ? '+' : '-';
            return sign + this.formatCurrency(Math.abs(amount));
        },

        // ==================== QUICK STATS UPDATES ====================

        /**
         * Update quick stats widget incrementally
         * NOTE: Quick stats are aggregated values, so incremental update is complex.
         * For now, fallback to full refresh for stats accuracy.
         *
         * @param {Object} fact - Fact data from WebSocket
         * @param {string} action - 'add' | 'remove'
         */
        updateQuickStats(fact, action) {
            // Quick stats aggregate Plan/Fact/Execution% for current month
            // Incremental update would require knowing:
            // - If fact is in current month
            // - Current totals to recalculate percentages
            // This is complex and error-prone, so fallback to refresh
            this.fallbackRefresh('quick-stats');
        },

        // ==================== ACCOUNT BALANCES UPDATES ====================

        /**
         * Update account balance card incrementally
         * @param {number} fcId - Financial center ID
         * @param {number} delta - Amount change (positive or negative)
         */
        updateAccountBalance(fcId, delta) {
            // Find balance card for this FC
            const card = document.querySelector(`.balance-card[data-fc-id="${fcId}"]`);
            if (!card) {
                // FC card not visible or not on page, skip
                console.debug('[IncrementalUpdates] FC card not found:', fcId);
                return;
            }

            // Find current balance value element
            const currentBalanceEl = card.querySelector('.balance-divider .balance-value');
            if (!currentBalanceEl) {
                this.fallbackRefresh('account-balances');
                return;
            }

            // Parse current value and update
            const mobileEl = currentBalanceEl.querySelector('.mobile-value');
            const desktopEl = currentBalanceEl.querySelector('.desktop-value');

            if (desktopEl) {
                const current = parseFloat(desktopEl.textContent.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
                const newValue = current + delta;
                desktopEl.textContent = this.formatCurrency(newValue);

                // Update color class
                const colorClass = newValue >= 0 ? 'text-success' : 'text-error';
                currentBalanceEl.classList.remove('text-success', 'text-error');
                currentBalanceEl.classList.add(colorClass);
            }

            if (mobileEl) {
                const current = parseFloat(mobileEl.textContent.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
                const newValue = current + delta;
                mobileEl.textContent = this.formatCurrencyMobile(newValue);
            }
        },

        // ==================== RECENT TRANSACTIONS UPDATES ====================

        /**
         * Prepend new transaction to recent transactions list
         * @param {Object} fact - Fact data from WebSocket
         */
        prependRecentTransaction(fact) {
            const article = this.getArticle(fact.article_id);
            if (!article) {
                // Can't render without article info, fallback
                console.debug('[IncrementalUpdates] Article not in cache:', fact.article_id);
                this.fallbackRefresh('recent-transactions');
                return;
            }

            const fc = fact.financial_center_id ? this.getFinancialCenter(fact.financial_center_id) : null;

            // Update desktop table
            const desktopTable = document.querySelector('#recent-transactions table tbody');
            if (desktopTable) {
                const row = this._renderDesktopTransactionRow(fact, article, fc);
                desktopTable.insertAdjacentHTML('afterbegin', row);

                // Remove last row if exceeds limit (10)
                const rows = desktopTable.querySelectorAll('tr');
                if (rows.length > 10) {
                    rows[rows.length - 1].remove();
                }
            }

            // Update mobile list
            const mobileList = document.querySelector('#recent-transactions .divide-y');
            if (mobileList) {
                const item = this._renderMobileTransactionItem(fact, article, fc);
                mobileList.insertAdjacentHTML('afterbegin', item);

                // Remove last item if exceeds limit
                const items = mobileList.querySelectorAll('.py-2');
                if (items.length > 10) {
                    items[items.length - 1].remove();
                }
            }
        },

        /**
         * Remove transaction from recent transactions list
         * @param {number} factId
         */
        removeRecentTransaction(factId) {
            // Remove from desktop table
            const row = document.querySelector(`#recent-transactions tr[data-fact-id="${factId}"]`);
            if (row) {
                row.remove();
            }

            // Remove from mobile list
            const item = document.querySelector(`#recent-transactions .py-2[data-fact-id="${factId}"]`);
            if (item) {
                item.remove();
            }

            // If list is now empty, might want to refresh to show placeholder
            const remaining = document.querySelectorAll('#recent-transactions tr, #recent-transactions .py-2');
            if (remaining.length === 0) {
                this.fallbackRefresh('recent-transactions');
            }
        },

        _renderDesktopTransactionRow(fact, article, fc) {
            const fcName = fc ? fc.name : '—';
            const description = fact.description || '—';
            const descTruncated = description.length > 30
                ? description.substring(0, 30) + '...'
                : description;
            const colorClass = this.getAmountColorClass(article.type);
            const amountFormatted = this.formatMoneyWithSign(fact.amount, article.type);
            const recordTypeBadge = fact.record_type === 'plan'
                ? '<span class="badge badge-info badge-sm">План</span>'
                : '<span class="badge badge-success badge-sm">Факт</span>';
            const offlineIcon = fact.is_offline_sync ? '☁️' : '';

            return `
                <tr data-fact-id="${fact.id}">
                    <td>${recordTypeBadge}</td>
                    <td class="whitespace-nowrap">${this.formatDateFull(fact.fact_date)}</td>
                    <td class="whitespace-nowrap">${fcName}</td>
                    <td>${article.name}</td>
                    <td class="${colorClass} whitespace-nowrap">${amountFormatted}</td>
                    <td class="max-w-xs truncate" title="${description}">${descTruncated}</td>
                    <td class="text-center" title="${offlineIcon ? 'Создано offline' : ''}">${offlineIcon}</td>
                </tr>
            `;
        },

        _renderMobileTransactionItem(fact, article, fc) {
            const colorClass = this.getAmountColorClass(article.type);
            const amountFormatted = this.formatMoneyWithSign(fact.amount, article.type);
            const recordTypeBadge = fact.record_type === 'plan'
                ? '<span class="badge badge-info badge-xs">План</span>'
                : '<span class="badge badge-success badge-xs">Факт</span>';
            const offlineIcon = fact.is_offline_sync
                ? '<span class="text-xs" title="Создано offline">☁️</span>'
                : '';

            // Build line2 parts
            const line2Parts = [this.formatDateShort(fact.fact_date)];
            if (fc) line2Parts.push(fc.name);
            if (fact.description) line2Parts.push(fact.description);

            return `
                <div class="py-2" data-fact-id="${fact.id}">
                    <div class="flex items-center gap-2">
                        ${recordTypeBadge}
                        <span class="flex-1 font-medium truncate">${article.name}</span>
                        ${offlineIcon}
                        <span class="${colorClass} whitespace-nowrap">${amountFormatted}</span>
                    </div>
                    <div class="text-xs text-base-content/60 mt-1 truncate">
                        ${line2Parts.join(' • ')}
                    </div>
                </div>
            `;
        },

        // ==================== HIGH-LEVEL EVENT HANDLERS ====================

        /**
         * Handle fact_created WebSocket event
         * @param {Object} data - Fact data from WebSocket
         */
        onFactCreated(data) {
            // Only process facts, not plans (they have separate handlers)
            if (data.record_type === 'plan') return;

            // 1. Update recent transactions - IMMEDIATE refresh for instant reminder icon display (no debounce)
            this.fallbackRefresh('recent-transactions');

            // 2. Update account balance if FC specified
            if (data.financial_center_id && data.amount) {
                const article = this.getArticle(data.article_id);
                if (article) {
                    // For expenses, balance decreases; for income, increases
                    const delta = (article.type === 'expense' || article.type === 'debit')
                        ? -Math.abs(data.amount)
                        : Math.abs(data.amount);
                    this.updateAccountBalance(data.financial_center_id, delta);
                }
            }

            // 3. Quick stats - fallback to refresh (aggregated data)
            this.fallbackRefreshDebounced('quick-stats');
        },

        /**
         * Handle fact_updated WebSocket event
         * @param {Object} data - Fact data from WebSocket
         */
        onFactUpdated(data) {
            // For updates, it's complex to track old vs new values
            // Fallback to full refresh for consistency
            this.fallbackRefreshDebounced('quick-stats');
            this.fallbackRefreshDebounced('account-balances');
            this.fallbackRefreshDebounced('recent-transactions');
        },

        /**
         * Handle fact_deleted WebSocket event
         * @param {Object} data - { id: factId }
         */
        onFactDeleted(data) {
            // Remove from recent transactions
            this.removeRecentTransaction(data.id);

            // For stats and balances, we don't have the deleted fact data
            // to calculate the reverse delta, so fallback to refresh
            this.fallbackRefreshDebounced('quick-stats');
            this.fallbackRefreshDebounced('account-balances');
        },

        /**
         * Handle plan_created WebSocket event
         * @param {Object} data - Plan data from WebSocket
         */
        onPlanCreated(data) {
            // Plans affect quick stats (Plan column)
            this.fallbackRefreshDebounced('quick-stats');

            // Plans also appear in recent transactions - IMMEDIATE refresh for instant reminder icon display (no debounce)
            this.fallbackRefresh('recent-transactions');
        },

        /**
         * Handle plan_updated WebSocket event
         * @param {Object} data - Plan data from WebSocket
         */
        onPlanUpdated(data) {
            this.fallbackRefreshDebounced('quick-stats');
            this.fallbackRefreshDebounced('recent-transactions');
        },

        /**
         * Handle plan_deleted WebSocket event
         * @param {Object} data - { id: planId }
         */
        onPlanDeleted(data) {
            this.removeRecentTransaction(data.id);
            this.fallbackRefreshDebounced('quick-stats');
        },

        /**
         * Handle transfer_created WebSocket event
         * @param {Object} data - Transfer data
         */
        onTransferCreated(data) {
            // Transfers affect two accounts
            this.fallbackRefreshDebounced('account-balances');
            this.fallbackRefreshDebounced('recent-transactions');
        },

        /**
         * Handle transfer_deleted WebSocket event
         * @param {Object} data - Transfer data
         */
        onTransferDeleted(data) {
            this.fallbackRefreshDebounced('account-balances');
            this.fallbackRefreshDebounced('recent-transactions');
        },

        // ==================== FALLBACK MECHANISM ====================

        _debounceTimers: {},
        _debounceDelay: 300, // ms

        /**
         * Fallback to HTMX widget refresh
         * @param {string} widgetId - Widget ID (quick-stats, account-balances, recent-transactions)
         */
        fallbackRefresh(widgetId) {
            if (window.HTMXWidgets && typeof window.HTMXWidgets.refreshWidget === 'function') {
                window.HTMXWidgets.refreshWidget(widgetId);
            } else {
                console.debug('[IncrementalUpdates] HTMXWidgets not available for fallback');
            }
        },

        /**
         * Fallback to HTMX widget refresh with debouncing
         * Prevents multiple rapid refreshes for the same widget
         * @param {string} widgetId
         */
        fallbackRefreshDebounced(widgetId) {
            clearTimeout(this._debounceTimers[widgetId]);
            this._debounceTimers[widgetId] = setTimeout(() => {
                this.fallbackRefresh(widgetId);
            }, this._debounceDelay);
        },

        /**
         * Cancel pending debounced refresh
         * @param {string} widgetId
         */
        cancelDebouncedRefresh(widgetId) {
            clearTimeout(this._debounceTimers[widgetId]);
        },

        // ==================== UTILITY ====================

        /**
         * Check if cache is ready
         * @returns {boolean}
         */
        isCacheReady() {
            return this._cacheInitialized;
        },

        /**
         * Clear cache (e.g., on logout or when data becomes stale)
         */
        clearCache() {
            this._articlesMap.clear();
            this._financialCentersMap.clear();
            this._cacheInitialized = false;
            this._cacheInitPromise = null;
        },

        /**
         * Refresh cache (e.g., when articles/FCs are updated)
         * @returns {Promise<boolean>}
         */
        async refreshCache() {
            this.clearCache();
            return await this.initCache();
        }
    };

    // Expose to global scope
    if (typeof window !== 'undefined') {
        window.IncrementalUpdates = IncrementalUpdates;
    }

})();
