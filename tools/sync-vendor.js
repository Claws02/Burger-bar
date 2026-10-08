// Copy runtime vendor files from node_modules into www/ so the web build and
// the iOS bundle use the exact versions pinned in package.json.
// Usage: node tools/sync-vendor.js   (runs automatically before `npm run ios:sync`)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const pairs = [
  ['node_modules/@capacitor/core/dist/capacitor.js', 'www/js/vendor/capacitor.js'],
];
for (const [from, to] of pairs) {
  fs.copyFileSync(path.join(root, from), path.join(root, to));
  console.log('vendored', to);
}
