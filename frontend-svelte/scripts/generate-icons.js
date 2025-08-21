import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple SVG icon template
const createSVGIcon = (size, color = '#1e293b', bgColor = '#3b82f6') => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${Math.floor(size * 0.2)}" fill="${color}"/>
  <rect x="${Math.floor(size * 0.2)}" y="${Math.floor(size * 0.3)}" width="${Math.floor(size * 0.6)}" height="${Math.floor(size * 0.4)}" rx="${Math.floor(size * 0.05)}" fill="${bgColor}"/>
  <circle cx="${Math.floor(size * 0.5)}" cy="${Math.floor(size * 0.5)}" r="${Math.floor(size * 0.15)}" fill="white"/>
  <path d="M${Math.floor(size * 0.5)} ${Math.floor(size * 0.4)}v${Math.floor(size * 0.2)}m-${Math.floor(size * 0.1)}-${Math.floor(size * 0.1)}h${Math.floor(size * 0.2)}" stroke="${color}" stroke-width="${Math.floor(size * 0.02)}" stroke-linecap="round"/>
</svg>`;

// Convert SVG to different sizes (placeholder - would need actual image conversion library)
const generateIcon = (size) => {
  const svg = createSVGIcon(size);
  const fileName = `icon-${size}x${size}.svg`;
  const filePath = path.join(__dirname, '../static/icons', fileName);
  
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  
  fs.writeFileSync(filePath, svg);
  console.log(`Generated ${fileName}`);
  
  // Create a placeholder PNG message (since we can't actually convert SVG to PNG without additional dependencies)
  const pngFileName = `icon-${size}x${size}.png`;
  const pngPath = path.join(__dirname, '../static/icons', pngFileName);
  const placeholderPng = `# This is a placeholder for ${pngFileName}
# In a real project, you would use an image conversion tool like:
# - sharp (npm package)
# - ImageMagick
# - Or an online converter to convert the SVG to PNG

# For now, copy the SVG content and convert manually:
${svg}`;
  
  fs.writeFileSync(pngPath + '.txt', placeholderPng);
};

// Generate all required icon sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

console.log('Generating PWA icons...');
sizes.forEach(generateIcon);

// Generate shortcut icons
const shortcutIcons = [
  { name: 'shortcut-expense', emoji: '💰' },
  { name: 'shortcut-budget', emoji: '📊' },
  { name: 'shortcut-reports', emoji: '📈' }
];

shortcutIcons.forEach(({ name, emoji }) => {
  const svg = `
<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="20" fill="#1e293b"/>
  <text x="48" y="65" text-anchor="middle" font-size="48" font-family="Arial, sans-serif">${emoji}</text>
</svg>`;
  
  const filePath = path.join(__dirname, '../static/icons', `${name}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`Generated ${name}.svg`);
});

// Generate favicon
const favicon = createSVGIcon(32);
fs.writeFileSync(path.join(__dirname, '../static/favicon.svg'), favicon);
console.log('Generated favicon.svg');

// Create apple-touch-icon
const appleTouchIcon = createSVGIcon(180);
fs.writeFileSync(path.join(__dirname, '../static/apple-touch-icon.svg'), appleTouchIcon);
console.log('Generated apple-touch-icon.svg');

console.log('\n✅ Icon generation complete!');
console.log('Note: SVG icons have been generated. For production, convert SVG files to PNG using:');
console.log('- Online converters (svg2png.com, etc.)');
console.log('- Command line tools (ImageMagick, Inkscape)');
console.log('- Build tools (sharp, svgo)');
console.log('\nReplace the .svg files with .png files of the same names.');