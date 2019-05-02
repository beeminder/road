# config valid only for current version of Capistrano
lock '3.4.0'

set :application, 'jsbrain'
set :repo_url, 'git@github.com:beeminder/road.git'
set :deploy_to, '/var/www/jsbrain'
set :linked_dirs, fetch(:linked_dirs, []).push('jsbrain_server/node_modules')


# Default config values
# =====================
# Default branch is :master
# ask :branch, `git rev-parse --abbrev-ref HEAD`.chomp
# set :deploy_to, '/var/www/my_app_name'
# set :scm, :git
# set :format, :pretty
# set :log_level, :debug
# set :pty, true
# set :keep_releases, 5
# Default value for :linked_files is []
# Default value for linked_dirs is []
# Default value for default_env is {}
# set :linked_files, fetch(:linked_files, []).push('config/database.yml', 'config/secrets.yml')
# set :linked_dirs, fetch(:linked_dirs, []).push('log', 'tmp/pids', 'tmp/cache', 'tmp/sockets', 'vendor/bundle', 'public/system')
# set :default_env, { path: "/opt/ruby/bin:$PATH" }


namespace :deploy do
  #desc 'Start / reload application'
  #task :restart do
  #  invoke 'pm2:reload'
  #end
  after :publishing, :restart
  after :restart, :clear_cache do
    on roles(:web), in: :groups, limit: 3, wait: 10 do
      # Here we can do anything such as:
      # within release_path do
      #   execute :rake, 'cache:clear'
      # end
    end
  end

end
