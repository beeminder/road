desc "check that we can access everything"
task :check_write_permissions do
  on roles(:all) do |host|
    if test("[ -w #{fetch(:deploy_to)} ]")
      info "#{fetch(:deploy_to)} is writable on #{host}"
    else
      error "#{fetch(:deploy_to)} is NOT writable on #{host}"
    end
  end
end

desc "test pm2 out"
task :test_pm2_outputs do
  on roles(:all) do |host|
    res = capture(:pm2, :jlist, :jsbrain)
      
  end
end

desc "what is current_path var"
task :current_path do
  on roles(:all) do |host|
    info "#{host}: #{current_path}"
  end
end
desc "what is release_path var"
task :release_path do
  on roles(:all) do |host|
    info "#{host}: #{release_path}"
  end
end