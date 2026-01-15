/**
 * Transfer Module - Modal Manager
 *
 * Modal visibility public API (wrapper for core operations).
 */

import { openTransferModal as coreOpenModal, closeTransferModal as coreCloseModal } from '../core/transferOperations';

/**
 * Open transfer modal (public API)
 */
export async function openModal(): Promise<void> {
  await coreOpenModal();
}

/**
 * Close transfer modal (public API)
 */
export function closeModal(): void {
  coreCloseModal();
}
