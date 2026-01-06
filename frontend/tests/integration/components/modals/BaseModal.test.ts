/**
 * Integration tests for BaseModal component
 *
 * Tests DaisyUI dialog wrapper functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseModal } from '@components/modals/BaseModal';

describe('BaseModal Integration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render dialog element with correct structure', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test Modal',
        content: '<p>Test content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      expect(dialog).toBeInstanceOf(HTMLDialogElement);
      expect(dialog.id).toBe('test-modal');
      expect(dialog.className).toBe('modal');

      const modalBox = dialog.querySelector('.modal-box');
      expect(modalBox).toBeTruthy();
    });

    it('should render title and close button', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test Title',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const title = dialog.querySelector('h3');
      expect(title?.textContent).toBe('Test Title');

      const closeButton = dialog.querySelector('.btn-circle');
      expect(closeButton).toBeTruthy();
      expect(closeButton?.textContent).toBe('✕');
    });

    it('should hide close button when hideCloseButton is true', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test Title',
        content: '<p>Content</p>',
        hideCloseButton: true
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const closeButton = dialog.querySelector('.btn-circle');
      expect(closeButton).toBeNull();
    });

    it('should render content as HTML element', () => {
      const contentElement = document.createElement('div');
      contentElement.id = 'custom-content';
      contentElement.textContent = 'Custom content';

      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: contentElement
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const content = dialog.querySelector('#custom-content');
      expect(content).toBeTruthy();
      expect(content?.textContent).toBe('Custom content');
    });

    it('should render content as HTML string', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<strong>Bold content</strong>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const strong = dialog.querySelector('strong');
      expect(strong?.textContent).toBe('Bold content');
    });

    it('should render backdrop when disableBackdropClose is false', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const backdrop = dialog.querySelector('.modal-backdrop');
      expect(backdrop).toBeTruthy();
    });

    it('should not render backdrop when disableBackdropClose is true', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>',
        disableBackdropClose: true
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const backdrop = dialog.querySelector('.modal-backdrop');
      expect(backdrop).toBeNull();
    });
  });

  describe('Open/Close Functionality', () => {
    it('should open modal when open() is called', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      expect(modal.isModalOpen()).toBe(false);

      modal.open();

      expect(modal.isModalOpen()).toBe(true);
      expect(dialog.open).toBe(true);
    });

    it('should close modal when close() is called', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();
      expect(modal.isModalOpen()).toBe(true);

      modal.close();
      expect(modal.isModalOpen()).toBe(false);
      expect(dialog.open).toBe(false);
    });

    it('should toggle modal state', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      expect(modal.isModalOpen()).toBe(false);

      modal.toggle();
      expect(modal.isModalOpen()).toBe(true);

      modal.toggle();
      expect(modal.isModalOpen()).toBe(false);
    });

    it('should not reopen if already open', () => {
      const onOpen = vi.fn();
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>',
        onOpen
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();
      expect(onOpen).toHaveBeenCalledTimes(1);

      // Try to open again
      modal.open();
      expect(onOpen).toHaveBeenCalledTimes(1); // Should not call again
    });

    it('should call onOpen callback when modal opens', () => {
      const onOpen = vi.fn();
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>',
        onOpen
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('should call onClose callback when modal closes', async () => {
      const onClose = vi.fn();
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>',
        onClose
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();
      modal.close();

      // Wait for close event to fire
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should close modal when close button is clicked', async () => {
      const onClose = vi.fn();
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>',
        onClose
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();

      const closeButton = dialog.querySelector('.btn-circle') as HTMLButtonElement;
      closeButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(modal.isModalOpen()).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Content Management', () => {
    it('should update title dynamically', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Original Title',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.setTitle('Updated Title');

      const title = dialog.querySelector('h3');
      expect(title?.textContent).toBe('Updated Title');
    });

    it('should update content with HTML element', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Original</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const newContent = document.createElement('div');
      newContent.id = 'new-content';
      newContent.textContent = 'New content';

      modal.setContent(newContent);

      const content = dialog.querySelector('#new-content');
      expect(content).toBeTruthy();
      expect(content?.textContent).toBe('New content');
    });

    it('should update content with HTML string', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Original</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.setContent('<strong>New content</strong>');

      const strong = dialog.querySelector('strong');
      expect(strong?.textContent).toBe('New content');
    });
  });

  describe('Element Access', () => {
    it('should return dialog element via getElement()', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      expect(modal.getElement()).toBe(dialog);
    });

    it('should return content container via getContentContainer()', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const contentContainer = modal.getContentContainer();
      expect(contentContainer).toBeTruthy();
      expect(contentContainer?.className).toBe('modal-content');
    });
  });

  describe('Lifecycle', () => {
    it('should throw error when opening before rendering', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      expect(() => modal.open()).toThrow('[BaseModal] Modal not rendered');
    });

    it('should clean up resources on destroy', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      modal.open();
      modal.destroy();

      expect(modal.getElement()).toBeNull();
      expect(dialog.parentElement).toBeNull(); // Removed from DOM
    });

    it('should return same dialog element on multiple render calls', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog1 = modal.render();
      const dialog2 = modal.render();

      expect(dialog1).toBe(dialog2);
    });
  });

  describe('Custom Sizing', () => {
    it('should apply custom size class', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>',
        size: 'max-w-4xl'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const modalBox = dialog.querySelector('.modal-box');
      expect(modalBox?.className).toContain('max-w-4xl');
    });

    it('should use default size when not specified', () => {
      const modal = new BaseModal({
        id: 'test-modal',
        title: 'Test',
        content: '<p>Content</p>'
      });

      const dialog = modal.render();
      container.appendChild(dialog);

      const modalBox = dialog.querySelector('.modal-box');
      expect(modalBox?.className).toContain('max-w-2xl'); // Default size
    });
  });
});
