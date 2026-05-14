module.exports = {
  apps: [
    {
      name: 'hicad-r',
      cwd: __dirname,
      script: 'pnpm',
      args: '--filter @hicad/backend start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3000',
        DATA_DIR: '/var/lib/hicad',
        FRONTEND_DIR: './frontend/dist'
      }
    }
  ]
};
