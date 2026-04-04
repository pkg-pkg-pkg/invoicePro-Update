const fs = require('fs');
const path = require('path');

console.log('🔧 Creating simplified build for .exe creation...');

// Create a simple package.json without native dependencies
const originalPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Create a simplified version for electron build
const simplifiedPackage = {
  ...originalPackageJson,
  dependencies: {
    ...originalPackageJson.dependencies,
    // Remove better-sqlite3 temporarily for building
    'better-sqlite3': undefined
  }
};

// Remove the undefined property
delete simplifiedPackage.dependencies['better-sqlite3'];

// Write temporary package.json
fs.writeFileSync('package-temp.json', JSON.stringify(simplifiedPackage, null, 2));

console.log('✅ Created temporary package.json without native dependencies');
console.log('📋 Next steps:');
console.log('1. Install Visual Studio Build Tools with C++ workload');
console.log('2. Run: npm install');
console.log('3. Run: npm run dist');
console.log('');
console.log('🚀 Alternative: Use the web version');
console.log('1. Run: npm run build');
console.log('2. Open dist/index.html in browser');
console.log('3. Test license validation flow');
console.log('');
console.log('📦 For immediate testing, use run-app.bat');
