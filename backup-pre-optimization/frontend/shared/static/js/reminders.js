/**
 * Shared module for reminder functionality
 * Used across index.html and plan.html
 *
 * ✅ FIX 4: Extracted from duplicated code to prevent desynchronization
 */
(function() {
    'use strict';

    /**
     * Create a reminder for a plan via API.
     * @param {number} factId - Plan/fact ID
     * @param {string} reminderDatetime - ISO datetime string
     * @returns {Promise<object|null>} Created reminder or null on error
     */
    async function createReminder(factId, reminderDatetime) {
        try {
            const response = await fetch(`/api/v1/reminders/${factId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    reminder_datetime: reminderDatetime
                })
            });

            if (response.ok) {
                const reminder = await response.json();
                console.log('[BudgetShared.Reminders.createReminder] Reminder created:', reminder);
                return reminder;
            } else {
                const error = await response.json();
                console.error('[BudgetShared.Reminders.createReminder] API error:', error);
                return null;
            }
        } catch (error) {
            console.error('[BudgetShared.Reminders.createReminder] Network error:', error);
            return null;
        }
    }

    /**
     * Delete a reminder for a plan via API.
     * @param {number} factId - Plan/fact ID
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async function deleteReminder(factId) {
        try {
            const response = await fetch(`/api/v1/reminders/${factId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok || response.status === 404) {
                console.log('[BudgetShared.Reminders.deleteReminder] Reminder deleted:', factId);
                return true;
            } else {
                const error = await response.json();
                console.error('[BudgetShared.Reminders.deleteReminder] API error:', error);
                return false;
            }
        } catch (error) {
            console.error('[BudgetShared.Reminders.deleteReminder] Network error:', error);
            return false;
        }
    }

    /**
     * Update a reminder datetime via API.
     * @param {number} factId - Plan/fact ID
     * @param {string} newReminderDatetime - New ISO datetime string
     * @returns {Promise<object|null>} Updated reminder or null on error
     */
    async function updateReminder(factId, newReminderDatetime) {
        try {
            const response = await fetch(`/api/v1/reminders/${factId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    reminder_datetime: newReminderDatetime
                })
            });

            if (response.ok) {
                const reminder = await response.json();
                console.log('[BudgetShared.Reminders.updateReminder] Reminder updated:', reminder);
                return reminder;
            } else {
                const error = await response.json();
                console.error('[BudgetShared.Reminders.updateReminder] API error:', error);
                return null;
            }
        } catch (error) {
            console.error('[BudgetShared.Reminders.updateReminder] Network error:', error);
            return null;
        }
    }

    // Export to global BudgetShared namespace
    window.BudgetShared = window.BudgetShared || {};
    window.BudgetShared.Reminders = {
        createReminder,
        deleteReminder,
        updateReminder
    };
})();
