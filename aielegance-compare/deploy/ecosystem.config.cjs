# PM2 helper — name MUST stay aielegance-com (Film Studio uses aielegance).
# Always listen on 3001. Never default to 3000.
module.exports = {
  apps: [
    {
      name: 'aielegance-com',
      cwd: '/var/www/aielegance-com',
      script: '/var/www/aielegance-com/start.mjs',
      interpreter: 'node',
      env: {
        HOST: '127.0.0.1',
        PORT: '3001',
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: '3001',
        NODE_ENV: 'production'
      }
    }
  ]
}
