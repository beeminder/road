require 'json'
namespace :pm2 do


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
