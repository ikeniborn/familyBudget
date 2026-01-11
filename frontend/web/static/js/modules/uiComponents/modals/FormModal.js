/**
 * FormModal - Modal with integrated form validation and submission
 *
 * Extends BaseModal to provide form-specific functionality:
 * - Automatic form validation before submission
 * - Submit/Cancel action buttons
 * - Loading states during submission
 * - Error handling and display
 *
 * @example
 * ```typescript
 * const modal = new FormModal({
 *   id: 'transaction-modal',
 *   title: 'Add Transaction',
 *   formContent: transactionForm.getElement()!,
 *   submitLabel: 'Save',
 *   onValidate: () => transactionForm.validate(),
 *   onSubmit: async () => {
 *     const data = transactionForm.collectFormData();
 *     await saveTransaction(data);
 *   },
 *   onSuccess: () => {
 *     showToast('Transaction saved!', 'success');
 *   }
 * });
 *
 * document.body.appendChild(modal.render());
 * modal.open();
 * ```
 *
 * @category Modal Components
 */
import { BaseModal } from './BaseModal';
export class FormModal {
    constructor(props) {
        this.props = props;
        this.submitButton = null;
        this.cancelButton = null;
        this.errorContainer = null;
        this.isSubmitting = false;
        // Create form wrapper
        const formWrapper = this.createFormWrapper();
        // Initialize base modal
        this.baseModal = new BaseModal({
            id: props.id,
            title: props.title,
            size: props.size,
            content: formWrapper,
            hideCloseButton: props.hideCloseButton,
            disableBackdropClose: props.disableBackdropClose,
            onOpen: props.onOpen,
            onClose: () => {
                this.clearError();
                if (props.onClose) {
                    props.onClose();
                }
            }
        });
    }
    /**
     * Create form wrapper with action buttons
     */
    createFormWrapper() {
        const wrapper = document.createElement('div');
        // Form content
        if (this.props.formContent instanceof HTMLElement) {
            wrapper.appendChild(this.props.formContent);
        }
        // Error container
        this.errorContainer = document.createElement('div');
        this.errorContainer.className = 'alert alert-error mt-4 hidden';
        this.errorContainer.role = 'alert';
        wrapper.appendChild(this.errorContainer);
        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'modal-action mt-4';
        // Cancel button
        this.cancelButton = document.createElement('button');
        this.cancelButton.type = 'button';
        this.cancelButton.className = 'btn btn-sm btn-ghost';
        this.cancelButton.textContent = this.props.cancelLabel || '❌ Отмена';
        this.cancelButton.addEventListener('click', () => this.handleCancel());
        actions.appendChild(this.cancelButton);
        // Submit button
        this.submitButton = document.createElement('button');
        this.submitButton.type = 'button';
        this.submitButton.className = `btn btn-sm ${this.props.submitButtonClass || 'btn-primary'}`;
        this.submitButton.textContent = this.props.submitLabel || '✅ Сохранить';
        this.submitButton.addEventListener('click', () => this.handleSubmit());
        actions.appendChild(this.submitButton);
        wrapper.appendChild(actions);
        return wrapper;
    }
    /**
     * Handle cancel action
     */
    handleCancel() {
        if (this.props.onCancel) {
            this.props.onCancel();
        }
        this.close();
    }
    /**
     * Handle submit action
     */
    async handleSubmit() {
        if (this.isSubmitting) {
            return;
        }
        // Clear previous errors
        this.clearError();
        // Validate
        if (this.props.onValidate) {
            const validation = this.props.onValidate();
            if (!validation.valid) {
                this.showError(validation.error || 'Проверьте правильность заполнения полей');
                return;
            }
        }
        // Set loading state
        this.isSubmitting = true;
        this.setLoading(true);
        try {
            // Call submit handler
            await this.props.onSubmit();
            // Call success handler
            if (this.props.onSuccess) {
                this.props.onSuccess();
            }
            // Close modal on success (unless disabled)
            if (!this.props.keepOpenOnSuccess) {
                this.close();
            }
        }
        catch (error) {
            console.error('[FormModal] Submit error:', error);
            // Call error handler or show default error
            if (this.props.onError) {
                this.props.onError(error);
            }
            else {
                this.showError(error.message || 'Ошибка при сохранении');
            }
        }
        finally {
            this.isSubmitting = false;
            this.setLoading(false);
        }
    }
    /**
     * Set loading state on submit button
     */
    setLoading(loading) {
        if (!this.submitButton)
            return;
        if (loading) {
            this.submitButton.disabled = true;
            this.submitButton.classList.add('loading');
            this.submitButton.textContent = '⏳ Сохранение...';
            if (this.cancelButton) {
                this.cancelButton.disabled = true;
            }
        }
        else {
            this.submitButton.disabled = false;
            this.submitButton.classList.remove('loading');
            this.submitButton.textContent = this.props.submitLabel || '✅ Сохранить';
            if (this.cancelButton) {
                this.cancelButton.disabled = false;
            }
        }
    }
    /**
     * Show error message
     */
    showError(message) {
        if (!this.errorContainer)
            return;
        this.errorContainer.textContent = message;
        this.errorContainer.classList.remove('hidden');
    }
    /**
     * Clear error message
     */
    clearError() {
        if (!this.errorContainer)
            return;
        this.errorContainer.textContent = '';
        this.errorContainer.classList.add('hidden');
    }
    /**
     * Render the modal
     */
    render() {
        return this.baseModal.render();
    }
    /**
     * Open the modal
     */
    open() {
        this.baseModal.open();
    }
    /**
     * Close the modal
     */
    close() {
        this.baseModal.close();
    }
    /**
     * Toggle modal open/close
     */
    toggle() {
        this.baseModal.toggle();
    }
    /**
     * Check if modal is currently open
     */
    isModalOpen() {
        return this.baseModal.isModalOpen();
    }
    /**
     * Update modal title
     */
    setTitle(title) {
        this.baseModal.setTitle(title);
        this.props.title = title;
    }
    /**
     * Update form content
     */
    setFormContent(content) {
        const container = this.baseModal.getContentContainer();
        if (!container)
            return;
        // Clear and replace content (preserve error container and actions)
        const firstChild = container.firstChild;
        if (firstChild && firstChild !== this.errorContainer) {
            container.replaceChild(content, firstChild);
        }
        this.props.formContent = content;
    }
    /**
     * Get the dialog element
     */
    getElement() {
        return this.baseModal.getElement();
    }
    /**
     * Get the content container
     */
    getContentContainer() {
        return this.baseModal.getContentContainer();
    }
    /**
     * Destroy the modal
     */
    destroy() {
        this.baseModal.destroy();
        this.submitButton = null;
        this.cancelButton = null;
        this.errorContainer = null;
    }
}
//# sourceMappingURL=FormModal.js.map