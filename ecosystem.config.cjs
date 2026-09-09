module.exports = {
  apps: [
    {
      name: 'nabiz',
      script: 'dist-server/index.js',
      cwd: 'C:/Projects/Nabiz',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      }
    }
  ]
};
