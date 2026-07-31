const { execFileSync } = require('child_process');

const port = Number(process.argv[2] || 5173);
if (!Number.isInteger(port) || port <= 0) process.exit(0);

try {
  if (process.platform === 'win32') {
    const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
    const pids = new Set();

    for (const line of output.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5 || parts[0] !== 'TCP') continue;
      const [, localAddress, , state, pid] = parts;
      if (state === 'LISTENING' && localAddress.endsWith(`:${port}`) && pid !== '0') {
        pids.add(pid);
      }
    }

    for (const pid of pids) {
      execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' });
      console.log(`Freed port ${port} by stopping PID ${pid}.`);
    }
  } else {
    const output = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
    for (const pid of output.split(/\s+/).filter(Boolean)) {
      execFileSync('kill', ['-9', pid], { stdio: 'ignore' });
      console.log(`Freed port ${port} by stopping PID ${pid}.`);
    }
  }
} catch {
  // No listener found, or the platform command is unavailable.
}
