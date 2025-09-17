/**
 * Simple validation script to test button onclick functionality
 * This can be run in the browser console to verify button behavior
 */

// Test function to verify button onclick handlers are working
function testButtonOnClick() {
  console.log('Testing button onclick functionality...');

  // Find all buttons on the page
  const buttons = document.querySelectorAll('button');
  console.log(`Found ${buttons.length} buttons on the page`);

  // Check if buttons have onclick handlers
  let buttonsWithHandlers = 0;
  buttons.forEach((button, index) => {
    const hasOnClick = button.onclick !== null;
    const hasEventListeners = typeof getEventListeners !== 'undefined' ?
      Object.keys(getEventListeners(button)).length > 0 : 'Unknown';

    console.log(`Button ${index + 1}:`, {
      text: button.textContent?.trim(),
      disabled: button.disabled,
      hasOnClick,
      hasEventListeners,
      className: button.className
    });

    if (hasOnClick || hasEventListeners !== 'Unknown') {
      buttonsWithHandlers++;
    }
  });

  console.log(`Buttons with handlers: ${buttonsWithHandlers}/${buttons.length}`);

  // Test clicking the first enabled button
  const firstEnabledButton = Array.from(buttons).find(btn => !btn.disabled);
  if (firstEnabledButton) {
    console.log('Testing click on first enabled button:', firstEnabledButton.textContent?.trim());

    // Add a temporary click listener to verify events are firing
    const testHandler = (e) => {
      console.log('✅ Button click event fired successfully!', e);
      firstEnabledButton.removeEventListener('click', testHandler);
    };

    firstEnabledButton.addEventListener('click', testHandler);

    // Simulate click
    setTimeout(() => {
      firstEnabledButton.click();
    }, 100);
  } else {
    console.log('No enabled buttons found to test');
  }
}

// Make function available globally for console testing
window.testButtonOnClick = testButtonOnClick;

console.log('Button validation script loaded. Run testButtonOnClick() to test buttons.');