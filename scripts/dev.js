const { spawn } = require('child_process');
const { createServer } = require('vite');

async function start() {
  const server = await createServer({ configFile: 'vite.config.ts' });
  await server.listen(5173);
  const url = `http://localhost:${server.config.server.port}`;
  console.log(`Vite dev server: ${url}`);

  // Build electron main process
  const { execSync } = require('child_process');
  execSync('npx tsc -p tsconfig.electron.json', { stdio: 'inherit' });

  // Launch Electron
  const electron = spawn(
    require('electron'),
    ['.'],
    { env: { ...process.env, VITE_DEV_SERVER_URL: url }, stdio: 'inherit' }
  );
  electron.on('close', () => { server.close(); process.exit(); });
}

start();
