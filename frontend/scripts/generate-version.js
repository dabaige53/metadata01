const fs = require('fs');
const path = require('path');

const buildIdPath = path.join(__dirname, '../.next/BUILD_ID');
const outputPath = path.join(__dirname, '../.next/static/version.json');

try {
  const buildId = fs.readFileSync(buildIdPath, 'utf8').trim();
  const versionData = {
    buildId,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(versionData));
  console.log('Generated version.json with buildId:', buildId);
} catch (err) {
  console.error('Failed to generate version.json:', err.message);
  process.exit(1);
}
