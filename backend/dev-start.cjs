const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const cwd = __dirname;
const out = fs.openSync(path.join(cwd, 'backend-start.log'), 'a');
const err = fs.openSync(path.join(cwd, 'backend-error.log'), 'a');

const child = spawn(process.execPath, ['server.js'], {
  cwd,
  detached: true,
  stdio: ['ignore', out, err],
  windowsHide: true
});

child.unref();
console.log(`Started backend PID ${child.pid}`);
