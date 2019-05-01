require 'json'
namespace :pm2 do
  def app_status
    within current_path do
      jlist = JSON.parse(capture :pm2, :jlist) 
      ps = jlist.select{|p| p["name"] == fetch(:application)}
      if ps.empty?
        return nil
      else
        # status: online, errored, stopped
        return ps[0]["pm2_env"]["status"]
      end
    end
  end

  def reload_app
    within current_path do
      execute :pm2, :reload, fetch(:application)
    end
  end
  
  def start_app
    info "current_path in start_app is #{current_path}"
    within current_path do
      execute :pm2, :startOrReload, "config/ecosystem.config.js" 
    end
  end
  
  desc 'Restart app gracefully'
  task :reload do
    on roles(:app) do
      case app_status
      when nil
        info 'App is not registerd'
        start_app
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
end
