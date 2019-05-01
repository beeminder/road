require 'json'
namespace :pm2 do
def app_status
    within current_path do
      ps = JSON.parse(capture :pm2, :jlist, fetch(:app_command))
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
      execute :pm2, :reload, fetch(:app_command)
    end
  end
  
  def start_app
    within current_path do
      execute :pm2, :stop, fetch(:app_command)
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
