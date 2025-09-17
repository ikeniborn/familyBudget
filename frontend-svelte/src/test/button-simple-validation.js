// Simple browser console test for button functionality
// Run this in the browser console on the articles page

console.log('=== Button Click Test Starting ===');

// Test 1: Check if Button components exist
const buttons = document.querySelectorAll('button');
console.log(`Found ${buttons.length} button elements`);

// Test 2: Check for event listeners
const createButton = document.querySelector('button.flex.items-center.gap-2');
if (createButton) {
  console.log('Create button found:', createButton.textContent.trim());

  // Check if button has any click handlers
  const hasListeners = typeof getEventListeners !== 'undefined' ?
    getEventListeners(createButton) : 'Cannot check (use Chrome DevTools)';
  console.log('Event listeners:', hasListeners);

  // Try to trigger click programmatically
  console.log('Attempting programmatic click...');
  createButton.click();
  console.log('Click triggered - check if modal opened');
} else {
  console.error('Create button not found!');
}

// Test 3: Check for Svelte internal handlers
const allButtons = Array.from(buttons);
let svelteBound = 0;
allButtons.forEach((btn, i) => {
  // Svelte adds internal properties starting with __svelte
  const keys = Object.keys(btn);
  const svelteKeys = keys.filter(k => k.startsWith('__svelte'));
  if (svelteKeys.length > 0) {
    svelteBound++;
    console.log(`Button ${i}: ${btn.textContent.trim().substring(0, 20)}... has Svelte bindings`);
  }
});

console.log(`${svelteBound}/${buttons.length} buttons have Svelte event bindings`);

// Test 4: Check modal state
const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"]');
console.log(`Found ${modals.length} potential modal elements`);

console.log('=== Button Click Test Complete ===');
console.log('Manual test: Try clicking "Создать статью" button');
