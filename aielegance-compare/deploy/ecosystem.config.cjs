# PM2 helper — name MUST stay aielegance-com (Film Studio uses aielegance).
module.exports = {
  apps: [
    {
      name: 'aielegance-com',
      cwd: '/var/www/aielegance-com',
      script: '/var/www/aielegance-com/.output/server/index.mjs',
      interpreter: 'node',
      env: {
        HOST: '127.0.0.1',
        PORT: '3001',
        NODE_ENV: 'production'
      }
    }
  ]
}
