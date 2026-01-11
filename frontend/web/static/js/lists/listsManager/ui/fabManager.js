/**
 * FAB (Floating Action Button) Manager
 * Handles opening/closing FAB speed dial menu
 */
/**
 * Toggle FAB (Floating Action Button) speed dial menu
 */
export function toggleListsFAB() {
    const menu = document.getElementById('lists-fab-menu');
    const backdrop = document.getElementById('lists-fab-backdrop');
    const addItemFAB = document.getElementById('add-item-fab');
    if (!menu || !backdrop)
        return;
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
        // Close FAB
        menu.classList.remove('open');
        menu.classList.add('closed');
        backdrop.classList.add('opacity-0', 'pointer-events-none', 'hidden');
        // Restore add-item-fab
        if (addItemFAB) {
            addItemFAB.classList.remove('hidden');
            debugLog('[FAB] add-item-fab shown (Speed Dial closed)');
        }
    }
    else {
        // Open FAB
        menu.classList.remove('closed');
        menu.classList.add('open');
        backdrop.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
        // Hide add-item-fab to prevent overlap
        if (addItemFAB) {
            addItemFAB.classList.add('hidden');
            debugLog('[FAB] add-item-fab hidden (Speed Dial opened)');
        }
    }
}
//# sourceMappingURL=fabManager.js.map