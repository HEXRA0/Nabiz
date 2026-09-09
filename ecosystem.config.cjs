module.exports = {
  apps: [
    {
      name: 'nabiz',
      script: 'server/index.ts',
      interpreter: 'node_modules/.bin/tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
        PUBLIC_URL: 'https://nabiz.thedemir.com'
      }
    }
  ]
};
