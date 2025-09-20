const fs = require('fs');
const { compile } = require('svelte/compiler');

try {
  // Test Input component
  const inputContent = fs.readFileSync('./frontend-svelte/src/lib/components/ui/Input.svelte', 'utf8');
  compile(inputContent);
  console.log('✅ Input component syntax OK');

  // Test FactForm component
  const factFormContent = fs.readFileSync('./frontend-svelte/src/lib/components/fact/FactForm.svelte', 'utf8');
  compile(factFormContent);
  console.log('✅ FactForm component syntax OK');

  // Test fact page
  const factPageContent = fs.readFileSync('./frontend-svelte/src/routes/(protected)/fact/+page.svelte', 'utf8');
  compile(factPageContent);
  console.log('✅ Fact page syntax OK');

} catch (error) {
  console.error('❌ Syntax error:', error.message);
  process.exit(1);
}