require 'json'
namespace :pm2 do

  def run_task(*args)
    within fetch(:pm2_target_path, release_path) do
      execute *args
    end
  end

  def app_name
    fetch(:pm2_app_name) || fetch(:application)
  end
  
  def app_status
    within release_path do
      jlist = JSON.parse(capture :pm2, :jlist) 
      ps = jlist.select{|p| p["name"] == app_name }
      if ps.empty?
        return nil
      else
        # status: online, errored, stopped
        return ps[0]["pm2_env"]["status"]
      end
    end
  end

  def reload_app
    within release_path do
      execute :pm2, :startOrReload, "config/ecosystem.config.js" 
    end
  end
  
  desc 'List all pm2 applications'
  task :status do
    run_task :pm2, :list
  end

  desc 'Start pm2 application'
  task :start do
    run_task :pm2, :start, fetch(:pm2_app_command)
  end

  desc 'Stop pm2 application'
  task :stop do
    run_task :pm2, :stop, app_name
  end

  desc 'Delete pm2 application'
  task :delete do
    run_task :pm2, :delete, app_name
  end

  desc 'Show pm2 application info'
  task :list do
    run_task :pm2, :show, app_name
  end

  desc 'Watch pm2 logs'
  task :logs do
    run_task :pm2, :logs
  end

  desc 'Save pm2 state so it can be loaded after restart'
  task :save do
    run_task :pm2, :save
  end

  desc 'Install pm2 via npm on the remote host'
  task :setup do
    run_task :npm, :install,  'pm2 -g'
  end


  
  desc 'Restart/reload app gracefully'
  task :restart do
    on roles(:app) do
      case app_status
      when nil
        info 'App is not registerd'
        reload_app 
      when 'stopped'
        info 'App is stopped'
        reload_app 
      when 'errored'
        info 'App has errored'
        reload_app 
      when 'online'
        info 'App is online'
        reload_app 
      end
    end
  end

  before 'deploy:restart', 'pm2:restart'

end

namespace :load do
  task :defaults do
    set :pm2_app_command, 'main.js'
    set :pm2_app_name, nil
  end
end
