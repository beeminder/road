# Server setup 
# =============
server '45.33.72.137:1912', user: 'beeminder', roles: %w{app},
  ssh_options: {
    user: 'beeminder', # overrides user setting above
    forward_agent: true,
  }

# Configuration
# =============
set :branch, "curie-test-deploy"
set :npm_target_path, -> { release_path.join('jsbrain_server') }

# PM2 Config
# ==========
set :pm2_app_command, "startOrReload config/ecosystem.config.js"
set :pm2_app_name, "jsbrain"
