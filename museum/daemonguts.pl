#!/usr/bin/env perl
# Beebrain Daemon Guts: Called by the daemon whenever a .bb file changes.
# Argument is the .bb file that changed, plus any other arguments that may
# be passed along to the Beebrain command line script.
# We abort the call to Beebrain after 3 minutes.
# Cf http://stackoverflow.com/questions/601543/command-line-command-to-auto-kill

$| = 1;  # autoflush so it doesn't wait till newline to print stuff.

$path = "/var/www/beebrain";
chdir($path);

#$ENV{'DISPLAY'} = ":250"; # for Mma, where VNC virtual X server is running

$file = shift;  # damaenguts gets passed actual filenames.
#$otherargs = join(' ', @ARGV);

#if($file !~ m|/([^/]+\.bb)\s*$|) {  # make sure $file is a beebrain input file.
# print "ERROR: not a .bb file: [$file]\n"; 
# exit(1);
#}

system("ulimit -t 180; python $path/beebrain.py $file");
