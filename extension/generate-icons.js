/**
 * Icon Generator Script
 * Run this with Node.js to generate PNG icons from SVG
 * 
 * Prerequisites: npm install sharp
 * Usage: node generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon SVG template
const iconSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#2563eb"/>
  <path d="M${size * 0.7} ${size * 0.25}H${size * 0.35}a${size * 0.07} ${size * 0.07} 0 0 0-${size * 0.07} ${size * 0.07}v${size * 0.43}a${size * 0.07} ${size * 0.07} 0 0 0 ${size * 0.07} ${size * 0.07}h${size * 0.35}a${size * 0.07} ${size * 0.07} 0 0 0 ${size * 0.07}-${size * 0.07}V${size * 0.32}a${size * 0.07} ${size * 0.07} 0 0 0-${size * 0.07}-${size * 0.07}z" fill="white"/>
  <polyline points="${size * 0.7} ${size * 0.25} ${size * 0.7} ${size * 0.4} ${size * 0.85} ${size * 0.4}" stroke="#2563eb" stroke-width="${size * 0.05}" fill="none"/>
  <line x1="${size * 0.4}" y1="${size * 0.5}" x2="${size * 0.6}" y2="${size * 0.5}" stroke="#2563eb" stroke-width="${size * 0.05}"/>
  <line x1="${size * 0.4}" y1="${size * 0.65}" x2="${size * 0.6}" y2="${size * 0.65}" stroke="#2563eb" stroke-width="${size * 0.05}"/>
</svg>
`;

const sizes = [16, 48, 128];
const outputDir = path.join(__dirname, 'icons');

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const size of sizes) {
    const svg = iconSvg(size);
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    
    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated icon-${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-${size}.png:`, error.message);
    }
  }

  console.log('\nDone! Icons generated in:', outputDir);
}

generateIcons();