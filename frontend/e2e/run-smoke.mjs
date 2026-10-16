import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const python = fileURLToPath(new URL(process.platform === 'win32'
  ? '../../venv/Scripts/python.exe' : '../../venv/bin/python', import.meta.url));
const child = spawn(existsSync(python) ? python : 'python',
  ['backend/scripts/smoke_server.py', process.execPath], { cwd: root, stdio: 'inherit' });
// Console Ctrl+C reaches the whole process group; allow the harness to clean up.
process.on('SIGINT', () => {});
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
