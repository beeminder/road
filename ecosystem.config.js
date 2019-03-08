module.exports = {
  apps : [{
    name: 'jsbrain',
    script: 'jsbrain_server.js',

    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    args: '',
    cwd: 'jsbrain_server',
    port: 877,
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
  }],

  deploy : {
    curie: {
      user : 'beeminder',
      host : [{host: '45.33.72.137', port: '1912'}],
      ssh_options: ['ForwardAgent=yes'],
      ref  : 'origin/master',
      repo : 'git@github.com:beeminder/road.git',
      path : '/var/www/jsbrain',
      "post-deploy" : 'ln -s ../shared/node_modules jsbrain_server/node_modules && cd jsbrain_server && npm install && pm2 reload jsbrain',
      "post-setup" : 'mkdir ../shared/node_modules'
    },
    production: {
      user : 'beeminder',
      host : ['23.92.16.25', '23.239.11.250'],
      ssh_options: ['ForwardAgent=yes'],
      ref  : 'origin/master',
      repo : 'git@github.com:beeminder/road.git',
      path : '/var/www/jsbrain',
      'post-deploy' : 'cd jsbrain_server && npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
