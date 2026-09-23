const fs = require('node:fs');
const path = require('node:path');
const serverRoot = path.resolve(__dirname, '..');
const target = path.resolve(serverRoot, 'dist');
if (path.dirname(target) !== serverRoot || path.basename(target) !== 'dist')
  throw new Error('Unsafe build output path');
if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())
  throw new Error('Build output cannot be a symbolic link');
fs.rmSync(target, { recursive: true, force: true });
