/* Runs the local API and the Vite dev server together. */
import { spawn } from 'node:child_process';

const run = (name, cmd, args) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    console.log(`\n${name} exited (${code})`);
    process.exit(code ?? 0);
  });
  return child;
};

run('api', 'node', ['server/index.mjs']);
run('web', 'npx', ['vite']);
