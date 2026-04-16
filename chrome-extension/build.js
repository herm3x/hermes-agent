const { spawnSync } = require('child_process');
const path = require('path');

const wpBin = path.join(__dirname, 'node_modules', 'webpack', 'bin', 'webpack.js');
const result = spawnSync('bun', [wpBin, '--mode', 'production', '--progress'], {
  cwd: __dirname,
  stdio: 'inherit',
  timeout: 30000,
});

if (result.status !== 0) {
  console.error('Build failed with code', result.status);
  process.exit(1);
}

const fs = require('fs');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  console.log('dist/ contains:', files.length, 'items:', files.join(', '));
} else {
  console.error('ERROR: dist/ directory does not exist after build!');
  process.exit(1);
}
