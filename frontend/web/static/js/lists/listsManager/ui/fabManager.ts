/**
 * FAB (Floating Action Button) Manager
 * Handles opening/closing FAB speed dial menu
 */

/**
 * Toggle FAB (Floating Action Button) speed dial menu
 */
export function toggleListsFAB(): void {
  const menu = document.getElementById('lists-fab-menu');
  const backdrop = document.getElementById('lists-fab-backdrop');

  if (!menu || !backdrop) return;

  const isOpen = menu.classList.contains('open');

  if (isOpen) {
    // Close Speed Dial
    menu.classList.remove('open');
    menu.classList.add('closed');
    backdrop.classList.add('opacity-0', 'pointer-events-none', 'hidden');
  } else {
    // Open Speed Dial
    menu.classList.remove('closed');
    menu.classList.add('open');
    backdrop.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
  }
}
