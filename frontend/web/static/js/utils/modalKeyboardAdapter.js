/**
 * Modal Keyboard Adapter
 *
 * Automatically adjusts modal positioning when virtual keyboard opens on mobile/PWA.
 *
 * Features:
 * - Detects keyboard open/close via VisualViewport API (fallback to window resize)
 * - Shifts active modal to top when keyboard opens
 * - Scrolls focused input into view
 * - Restores original position when keyboard closes
 * - Supports all DaisyUI modals (dialog.modal)
 * - Handles edge cases: multiple modals, orientation change, resize
 *
 * @version 6.6.0
 * @since 2025-12-28
 */

class ModalKeyboardAdapter {
    constructor() {
        // State
        this._activeModal = null;
        this._modalBox = null;
        this._originalPosition = null;
        this._isKeyboardOpen = false;
        this._initialHeight = null;

        // Timers
        this._resizeTimer = null;

        // Flag to suppress viewport scroll handler during programmatic modal-box scroll
        this._isProgrammaticScroll = false;

        // Auto-initialize
        this._init();
    }

    _init() {
        const isPWA = this._isPWA();
        logModalKB.info('Initializing Modal Keyboard Adapter', {
            isPWA,
            visualViewportAvailable: !!window.visualViewport,
            userAgent: navigator.userAgent
        });

        // Setup keyboard detection
        this._setupKeyboardDetection();

        // Setup modal lifecycle observer
        this._setupModalObserver();

        // Handle orientation changes
        this._setupOrientationHandler();

        // Handle window resize
        this._setupResizeHandler();

        // Initial CSS variables
        this._updateCSSVariables();

        logModalKB.info('✅ Adapter initialized successfully');
    }

    // ========================================
    // Keyboard Detection
    // ========================================

    _setupKeyboardDetection() {
        if (window.visualViewport) {
            // PRIMARY: VisualViewport API (iOS 13+, Chrome 61+)
            window.visualViewport.addEventListener('resize', this._onViewportResize.bind(this));
            window.visualViewport.addEventListener('scroll', this._onViewportScroll.bind(this));

            logModalKB.info('Using VisualViewport API for keyboard detection');
        } else {
            // FALLBACK: Window resize + focus tracking
            this._setupFallbackDetection();
            logModalKB.warn('VisualViewport not available, using fallback detection');
        }
    }

    _onViewportResize() {
        const viewport = window.visualViewport;
        const windowHeight = window.innerHeight;
        const viewportHeight = viewport.height;
        const heightDiff = windowHeight - viewportHeight;

        const wasOpen = this._isKeyboardOpen;
        this._isKeyboardOpen = heightDiff > 150; // Threshold: 150px

        logModalKB.debug('Viewport resize detected', {
            windowHeight,
            viewportHeight,
            heightDiff,
            keyboardOpen: this._isKeyboardOpen,
            stateChanged: wasOpen !== this._isKeyboardOpen
        });

        // Update CSS variables on every resize
        this._updateCSSVariables();

        // State change detection
        if (wasOpen !== this._isKeyboardOpen) {
            if (this._isKeyboardOpen) {
                this._onKeyboardOpen();
            } else {
                this._onKeyboardClose();
            }
        }
    }

    _onViewportScroll() {
        // Skip during programmatic modal-box scroll to prevent modal from closing
        if (this._isProgrammaticScroll) return;
        // VisualViewport scrolls when keyboard opens on some devices
        // Update CSS variables to maintain correct positioning
        if (this._isKeyboardOpen) {
            this._updateCSSVariables();
        }
    }

    _setupFallbackDetection() {
        let focusedInput = null;

        // Track focused input fields
        document.addEventListener('focusin', (e) => {
            if (this._isInputElement(e.target)) {
                focusedInput = e.target;

                logModalKB.debug('Input focused', {
                    tagName: e.target.tagName,
                    type: e.target.type
                });

                // Delay detection (wait for keyboard animation)
                setTimeout(() => this._checkKeyboardState(focusedInput), 300);
            }
        });

        document.addEventListener('focusout', (e) => {
            if (this._isInputElement(e.target)) {
                logModalKB.debug('Input blurred');
                focusedInput = null;
                setTimeout(() => this._checkKeyboardState(null), 300);
            }
        });

        // Window resize (less reliable)
        window.addEventListener('resize', () => {
            if (focusedInput) {
                this._checkKeyboardState(focusedInput);
            }
        });
    }

    _checkKeyboardState(focusedInput) {
        const currentHeight = window.innerHeight;
        const initialHeight = this._initialHeight || currentHeight;

        if (!this._initialHeight) {
            this._initialHeight = currentHeight;
        }

        const heightDiff = initialHeight - currentHeight;
        const wasOpen = this._isKeyboardOpen;

        // Keyboard open if: height decreased + input focused
        this._isKeyboardOpen = focusedInput && heightDiff > 150;

        logModalKB.debug('Fallback keyboard state check', {
            currentHeight,
            initialHeight,
            heightDiff,
            hasFocusedInput: !!focusedInput,
            keyboardOpen: this._isKeyboardOpen
        });

        if (wasOpen !== this._isKeyboardOpen) {
            if (this._isKeyboardOpen) {
                this._onKeyboardOpen();
            } else {
                this._onKeyboardClose();
            }
        }
    }

    // ========================================
    // Modal Lifecycle Management
    // ========================================

    _setupModalObserver() {
        // CRITICAL: Check if document.body exists (script may load in <head>)
        if (!document.body) {
            logModalKB.warn('document.body not ready, deferring modal observer setup');
            // Retry after DOM ready
            document.addEventListener('DOMContentLoaded', () => {
                this._setupModalObserver();
            });
            return;
        }

        // Observe <dialog> elements for 'open' attribute changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
                    const dialog = mutation.target;

                    if (dialog.classList.contains('modal') && dialog.hasAttribute('open')) {
                        this._onModalOpen(dialog);
                    } else if (this._activeModal === dialog) {
                        this._onModalClose(dialog);
                    }
                }
            });
        });

        // Observe all existing and future dialogs
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['open'],
            subtree: true
        });

        logModalKB.info('Modal observer initialized');
    }

    _onModalOpen(dialog) {
        // Handle multiple modals (close previous gracefully)
        if (this._activeModal && this._activeModal !== dialog) {
            logModalKB.warn('Multiple modals detected, replacing active modal', {
                previous: this._activeModal.id,
                new: dialog.id
            });

            if (this._modalBox) {
                this._restoreOriginalPosition();
            }
        }

        this._activeModal = dialog;
        this._modalBox = dialog.querySelector('.modal-box');

        if (!this._modalBox) {
            logModalKB.warn('Modal opened but .modal-box not found', {
                dialogId: dialog.id
            });
            return;
        }

        logModalKB.info('📱 Modal opened', {
            dialogId: dialog.id,
            isKeyboardOpen: this._isKeyboardOpen
        });

        // Store original position (for restoration)
        this._originalPosition = {
            marginTop: this._modalBox.style.marginTop,
            marginBottom: this._modalBox.style.marginBottom,
            maxHeight: this._modalBox.style.maxHeight
        };

        // Apply keyboard position if keyboard already open
        if (this._isKeyboardOpen) {
            this._applyKeyboardPosition();
        }
    }

    _onModalClose(dialog) {
        logModalKB.info('📱 Modal closed', {
            dialogId: dialog?.id
        });

        this._activeModal = null;
        this._modalBox = null;
        this._originalPosition = null;
    }

    // ========================================
    // Keyboard Open/Close Handlers
    // ========================================

    _onKeyboardOpen() {
        logModalKB.info('🎹 Keyboard opened', {
            hasActiveModal: !!this._activeModal,
            viewportHeight: window.visualViewport?.height || window.innerHeight
        });

        if (!this._activeModal || !this._modalBox) {
            logModalKB.debug('No active modal, skipping position adjustment');
            return;
        }

        this._applyKeyboardPosition();
        this._scrollActiveInputIntoView();
    }

    _applyKeyboardPosition() {
        this._updateCSSVariables();

        // Remove conflicting Tailwind classes that interfere with positioning
        this._modalBox.classList.remove('my-auto');

        // Add keyboard-active class
        this._modalBox.classList.add('modal-box--keyboard-active');
        this._modalBox.classList.add('modal-box--transitioning');

        const headerHeight = getComputedStyle(document.documentElement)
            .getPropertyValue('--header-height');
        const viewportHeight = getComputedStyle(document.documentElement)
            .getPropertyValue('--viewport-height');

        logModalKB.info('✅ Applied keyboard position', {
            headerHeight,
            viewportHeight,
            removedConflictingClass: 'my-auto'
        });

        // Remove transitioning class after animation
        setTimeout(() => {
            this._modalBox?.classList.remove('modal-box--transitioning');
        }, 300);
    }

    _scrollActiveInputIntoView() {
        const activeElement = document.activeElement;

        if (!this._isInputElement(activeElement)) {
            logModalKB.debug('No active input to scroll into view');
            return;
        }

        // Delay scroll (wait for position transition)
        setTimeout(() => {
            if (!activeElement || !this._activeModal) return;

            const modalBox = this._modalBox;
            const inputRect = activeElement.getBoundingClientRect();
            const modalRect = modalBox.getBoundingClientRect();

            // Input is below visible area
            if (inputRect.bottom > modalRect.bottom) {
                const scrollOffset = inputRect.bottom - modalRect.bottom + 20; // 20px padding
                this._isProgrammaticScroll = true;
                modalBox.scrollTop += scrollOffset;
                setTimeout(() => { this._isProgrammaticScroll = false; }, 150);

                logModalKB.debug('📜 Scrolled input into view (downward)', { scrollOffset });
            }

            // Input is above visible area
            if (inputRect.top < modalRect.top) {
                const scrollOffset = modalRect.top - inputRect.top + 20;
                this._isProgrammaticScroll = true;
                modalBox.scrollTop -= scrollOffset;
                setTimeout(() => { this._isProgrammaticScroll = false; }, 150);

                logModalKB.debug('📜 Scrolled input into view (upward)', { scrollOffset });
            }
        }, 350); // After position transition (300ms) + buffer
    }

    _onKeyboardClose() {
        logModalKB.info('🎹 Keyboard closed', {
            hasActiveModal: !!this._activeModal
        });

        if (!this._activeModal || !this._modalBox) {
            return;
        }

        this._restoreOriginalPosition();
    }

    _restoreOriginalPosition() {
        this._modalBox.classList.remove('modal-box--keyboard-active');
        this._modalBox.classList.add('modal-box--keyboard-restoring');
        this._modalBox.classList.add('modal-box--transitioning');

        // Restore Tailwind centering class
        this._modalBox.classList.add('my-auto');

        logModalKB.info('✅ Restored original position', {
            restoredClass: 'my-auto'
        });

        // Cleanup after transition
        setTimeout(() => {
            this._modalBox?.classList.remove('modal-box--keyboard-restoring');
            this._modalBox?.classList.remove('modal-box--transitioning');
        }, 300);
    }

    // ========================================
    // Edge Case Handlers
    // ========================================

    _setupOrientationHandler() {
        window.addEventListener('orientationchange', () => {
            logModalKB.info('📱 Orientation changed', {
                orientation: screen.orientation?.type || window.orientation
            });

            setTimeout(() => {
                this._updateCSSVariables();

                // Re-apply keyboard position if active
                if (this._isKeyboardOpen && this._modalBox) {
                    this._applyKeyboardPosition();
                }
            }, 300); // Wait for orientation animation
        });
    }

    _setupResizeHandler() {
        window.addEventListener('resize', () => {
            // Debounce resize events
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                logModalKB.debug('Window resized');
                this._updateCSSVariables();

                // Re-apply if keyboard active
                if (this._isKeyboardOpen && this._modalBox) {
                    this._applyKeyboardPosition();
                }
            }, 100);
        });
    }

    // ========================================
    // Utility Methods
    // ========================================

    _updateCSSVariables() {
        const header = document.querySelector('header') || document.querySelector('.navbar');
        const headerHeight = header ? header.offsetHeight : 64;

        const viewportHeight = window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;

        document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
        document.documentElement.style.setProperty('--viewport-height', `${viewportHeight}px`);

        logModalKB.debug('CSS variables updated', {
            headerHeight,
            viewportHeight
        });
    }

    _isInputElement(element) {
        if (!element) return false;

        const tagName = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();

        return (
            (tagName === 'input' && !['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(type)) ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            element.isContentEditable
        );
    }

    _isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true; // iOS Safari
    }
}

// Auto-initialize on module load
if (typeof window !== 'undefined') {
    const init = () => {
        window.modalKeyboardAdapter = new ModalKeyboardAdapter();
    };

    // Check DOM readiness before initializing
    if (document.readyState === 'loading') {
        // DOM not ready yet, wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready (interactive or complete), initialize immediately
        init();
    }
}
