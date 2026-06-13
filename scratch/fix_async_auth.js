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
    if (content.includes('getCurrentUser()')) {
      // Safely replace all instances without double-awaiting
      let updated = content
        .replace(/await\s+getCurrentUser\(\)/g, 'getCurrentUser()')
        .replace(/getCurrentUser\(\)/g, 'await getCurrentUser()');
      
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  }
});
