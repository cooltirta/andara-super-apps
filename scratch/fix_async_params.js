const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const apiDir = path.resolve(__dirname, '../app/api');
walkDir(apiDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('params')) {
      // Safely replace to ensure all params extractions are awaited
      let updated = content
        .replace(/const\s+\{\s*(\w+)\s*\}\s*=\s*await\s+params/g, 'const { $1 } = params')
        .replace(/const\s+\{\s*(\w+)\s*\}\s*=\s*params/g, 'const { $1 } = await params');
      
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log(`Updated params in: ${filePath}`);
    }
  }
});
