module.exports = {
  apps : [{
    name: 'jsbrain',
    script: 'npm start',
    cwd: '/var/www/jsbrain/current/jsbrain_server'
    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
