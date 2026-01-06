/**
 * BaseModal - Base wrapper for DaisyUI dialog modals
 *
 * Provides consistent modal lifecycle management with DaisyUI dialog elements.
 * Automatically integrates with ModalKeyboardAdapter for keyboard navigation.
 *
 * @example
 * ```typescript
 * const modal = new BaseModal({
 *   id: 'my-modal',
 *   title: 'My Modal',
 *   content: myFormElement,
 *   onOpen: () => {
 *     // Handle modal open
 *   },
 *   onClose: () => {
 *     // Handle modal close
 *   }
 * });
 *
 * document.body.appendChild(modal.render());
 *
 * // Later
 * modal.open();
 * ```
 *
 * @category Modal Components
 */

import type { BaseModalProps } from '../types';

// Declare global ModalKeyboardAdapter (if available)
declare const ModalKeyboardAdapter: {
  getInstance(): {
    attachToModal(modal: HTMLDialogElement): void;
  };
} | undefined;

export class BaseModal {
  private dialog: HTMLDialogElement | null = null;
  private modalBox: HTMLDivElement | null = null;
  private titleElement: HTMLHeadingElement | null = null;
  private contentContainer: HTMLDivElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private isOpen: boolean = false;

  constructor(private props: BaseModalProps) {}

  /**
   * Render the modal structure
   */
  render(): HTMLDialogElement {
    if (this.dialog) {
      return this.dialog;
    }

    // Create dialog element
    this.dialog = document.createElement('dialog');
    this.dialog.id = this.props.id;
    this.dialog.className = 'modal';

    // Create modal box
    this.modalBox = document.createElement('div');
    this.modalBox.className = `modal-box ${this.props.size || 'max-w-2xl'} p-4 max-h-[90vh] overflow-y-auto my-auto`;

    // Title section
    if (this.props.title) {
      const titleContainer = document.createElement('div');
      titleContainer.className = 'flex justify-between items-center mb-4';

      this.titleElement = document.createElement('h3');
      this.titleElement.className = 'font-bold text-lg';
      this.titleElement.textContent = this.props.title;
      titleContainer.appendChild(this.titleElement);

      // Close button (X)
      if (!this.props.hideCloseButton) {
        this.closeButton = document.createElement('button');
        this.closeButton.type = 'button';
        this.closeButton.className = 'btn btn-sm btn-circle btn-ghost';
        this.closeButton.innerHTML = '✕';
        this.closeButton.addEventListener('click', () => this.close());
        titleContainer.appendChild(this.closeButton);
      }

      this.modalBox.appendChild(titleContainer);
    }

    // Content container
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'modal-content';

    if (this.props.content instanceof HTMLElement) {
      this.contentContainer.appendChild(this.props.content);
    } else if (typeof this.props.content === 'string') {
      this.contentContainer.innerHTML = this.props.content;
    }

    this.modalBox.appendChild(this.contentContainer);

    this.dialog.appendChild(this.modalBox);

    // Backdrop (for clicking outside to close)
    if (!this.props.disableBackdropClose) {
      const backdrop = document.createElement('form');
      backdrop.method = 'dialog';
      backdrop.className = 'modal-backdrop';

      const backdropButton = document.createElement('button');
      backdropButton.textContent = 'close';
      backdrop.appendChild(backdropButton);

      this.dialog.appendChild(backdrop);
    }

    // Integrate with ModalKeyboardAdapter (if available)
    if (typeof ModalKeyboardAdapter !== 'undefined') {
      try {
        const adapter = ModalKeyboardAdapter.getInstance();
        adapter.attachToModal(this.dialog);
      } catch (error) {
        console.warn('[BaseModal] Failed to attach ModalKeyboardAdapter:', error);
      }
    }

    // Setup event listeners
    this.dialog.addEventListener('close', () => {
      this.isOpen = false;
      if (this.props.onClose) {
        this.props.onClose();
      }
    });

    return this.dialog;
  }

  /**
   * Open the modal
   */
  open(): void {
    if (!this.dialog) {
      throw new Error('[BaseModal] Modal not rendered. Call render() first.');
    }

    if (this.isOpen) {
      return;
    }

    this.dialog.showModal();
    this.isOpen = true;

    if (this.props.onOpen) {
      this.props.onOpen();
    }
  }

  /**
   * Close the modal
   */
  close(): void {
    if (!this.dialog) {
      return;
    }

    if (!this.isOpen) {
      return;
    }

    this.dialog.close();
    this.isOpen = false;

    // onClose callback is triggered by 'close' event listener
  }

  /**
   * Toggle modal open/close
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if modal is currently open
   */
  isModalOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Update modal title
   */
  setTitle(title: string): void {
    if (this.titleElement) {
      this.titleElement.textContent = title;
    }
  }

  /**
   * Update modal content
   */
  setContent(content: HTMLElement | string): void {
    if (!this.contentContainer) {
      return;
    }

    // Clear existing content
    this.contentContainer.innerHTML = '';

    if (content instanceof HTMLElement) {
      this.contentContainer.appendChild(content);
    } else {
      this.contentContainer.innerHTML = content;
    }

    // Update props
    this.props.content = content;
  }

  /**
   * Get the dialog element
   */
  getElement(): HTMLDialogElement | null {
    return this.dialog;
  }

  /**
   * Get the content container
   */
  getContentContainer(): HTMLDivElement | null {
    return this.contentContainer;
  }

  /**
   * Destroy the modal
   */
  destroy(): void {
    if (this.dialog) {
      this.close();
      this.dialog.remove();
      this.dialog = null;
      this.modalBox = null;
      this.titleElement = null;
      this.contentContainer = null;
      this.closeButton = null;
    }
  }
}
