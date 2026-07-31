const { execFileSync } = require('child_process');

const port = Number(process.argv[2] || process.env.PORT || 5005);
if (!Number.isInteger(port) || port <= 0) {
  process.exit(0);
}

const killWindowsPort = () => {
  const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0] !== 'TCP') continue;
    const [, localAddress, , state, pid] = parts;
    if (state !== 'LISTENING') continue;
    if (!localAddress.endsWith(`:${port}`)) continue;
    if (pid && pid !== '0') pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' });
      console.log(`Freed port ${port} by stopping PID ${pid}.`);
    } catch (error) {
      console.warn(`Could not stop PID ${pid} on port ${port}.`);
    }
  }
};

const killUnixPort = () => {
  try {
    const output = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
    for (const pid of output.split(/\s+/).filter(Boolean)) {
      try {
        execFileSync('kill', ['-9', pid], { stdio: 'ignore' });
        console.log(`Freed port ${port} by stopping PID ${pid}.`);
      } catch (error) {
        console.warn(`Could not stop PID ${pid} on port ${port}.`);
      }
    }
  } catch {
    // No process is listening on the port.
  }
};

try {
  if (process.platform === 'win32') {
    killWindowsPort();
  } else {
    killUnixPort();
  }
} catch {
  // Keep dev startup friendly even when no listener is found.
}
