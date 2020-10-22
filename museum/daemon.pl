#!/usr/bin/env perl
# Beebrain Daemon. Calls a helper script -- the daemon guts -- when any of a 
# set of files appear or change.

$| = 1;  # autoflush so it doesn't wait till newline to print stuff.

$path = "nonce";
$guts = "./daemonguts.pl";
#$guts = "sleep 1; echo pretending to run guts on"; # uncomment this for dry run

$bbglob = "$path/*.bb";

$brainings = 0; # total number of times we brained a goal
$tottime = 0;   # total amount of time spent braining
$rawtime = 0;   # total time on just braining, not counting overhead with queues
$inttime = 0;   # total time on braining plus directory walking
$hot = 0;       # we become cold if we walk the whole dir with nothing to update

print "The Beebrain daemon (v2127) is watching $bbglob ...\n";

# Initialize the %mt hash for last mod time of each file
@files = glob($bbglob);
for(@files) { $mt{$_} = mtime($_); } 
$mtp = mtime($path);

while(1) {
  $x = mtime($path);
  if(!$hot && $x == $mtp) { print "d"; sleep(1); next; } # sleep till dir mod'd
  $mtp = $x;                             

  $tstart = time; # total start: time the total braining plus globbing
  # have to re-glob occasionally or things could starve
  if(!$hot || $tstart % 10 == 0) {
    print "\nS";
    @files = sort { $mt{$a} <=> $mt{$b} } glob($bbglob);
    undef %missing;
    $b = $brainings || 1;
    printf("TATS: %i brainings @ %.3f-%.3f-%.3fs (%i files) ",
      $brainings, $rawtime/$b, $inttime/$b, $tottime/$b, $#files+1);
  } else { print "-";
  #  #@files = keys(%mt);
  }

  $istart = time;
  if($tstart % 20 == 0) { $hot = 0; } # be reluctant to go cold
  for my $f (@files) {
    $mtf = mtime($f);
    next if $mtf == $mt{$f};
    next if $missing{$f};
    if(!-e $f) {
      print "\nFILE WENT MISSING: $f\n";
      delete $mt{$f};
      $missing{$f} = 1; # remember it so we don't double-report it missing
      next;
    } # if we make it past here then file $f changed ---------------------------
    $hot = 1;

    showqueued(time % 10 != 0);
    my $newf = !defined($mt{$f}); # new file appeared
    print "\n",($newf ? "NEW" : "CHG"),": $f\n";
    $mt{$f} = $mtf;

    $rstart = time; # raw start: time the raw beebraining
    system("$guts $f"); # <----- actually call Beebrain here (via daemonguts)
    $rawtime += (time - $rstart);
    $brainings++;
  }

  $t = time;
  $tottime += ($t - $tstart);
  $inttime += ($t - $istart);
  if(!$hot) { print "c"; sleep(1); } # sleep after walking files & finding nada
  else { print "h"; }
}


sub mtime { my($f) = @_; return (stat($f))[9]; }

# Print all the files that appeared/changed/vanished. If quick is true then 
# don't do a glob.
sub showqueued { my($quick) = @_;
  my @all;
  my @vanished;
  my @appeared;
  my @changed;

  print "\n";
  if($quick) { print "q"; } else { print "Q"; }

  push(@all, keys(%mt));
  if(!$quick) { push(@all, glob($bbglob)); @all = uniquify(@all); }

  for my $f (@all) {
    if(!-e $f) { 
      push(@vanished, yoogify($f));
      delete $mt{$f};
    } elsif(!defined($mt{$f})) { # new file appeared
      push(@appeared, yoogify($f));
    } elsif(mtime($f) != $mt{$f}) {
      push(@changed, yoogify($f));
    }
  }
  #if(@vanished || @appeared || @changed) { print "\n"; }
  if(@vanished){ print "-vanished(".@vanished."): ",join(' ', @vanished),"\n"; }
  if(@appeared){ print "-appeared(".@appeared."): ",join(' ', @appeared),"\n"; }
  if(@changed) { print "-changed (".@changed. "): ",join(' ', @changed), "\n"; }
  if(!(@vanished || @appeared || @changed)) { print "\n"; }
}

# http://stackoverflow.com/q/7651/how-do-i-remove-duplicate-items
sub uniquify {
  my %seen = ();
  my @r = ();
  foreach my $a (@_) {
    unless($seen{$a}) {
      push @r, $a;
      $seen{$a} = 1;
    }
  }
  return @r;
}

# Turn a filename like dir/user+graph+stuff.bb into "user/graph" (yoog)
sub yoogify { my($s) = @_;
  if($s !~ /\+/) { return $s; }
  $s =~ s/^\w*\/?(.*?)\+?\w*\.bb/\1/;
  $s =~ s/\+/\//g;
  return $s;
}

# Would be faster to use opendir/readdir instead of glob (which does a stat on
# every file, apparently) but not worrying about that for now since we're just
# avoiding walking the directory list unless there's been idle time (sleepflag).
#opendir(my $dh, $path) || die;
#@files = grep { /\.bb$/ && -f "$path/$_" } readdir($dh);
#for my $f (grep { /\.bb$/ && -f "$path/$_" } readdir($dh)) { 
#  #$f = "$path/$f";
#  $mt{$f} = mtime($f);
#}
#closedir($dh);

# NOT CURRENTLY USED: (was for when we were scp'ing bb files in)
# After the given file hasn't changed for n seconds, returns how many 
#   seconds, at most, it took to stop changing.
# For example, if n=10 and it stops changing after 33 seconds then it will 
#   return after 50 seconds because 40-50 was the first 10-second interval
#   where it wasn't changing but it will return 40 seconds since it knows
#   it stopped changing in the 30-40 second interval.
sub quiesce {
  ($f, $n) = @_;
  return 0 if $n == 0;
  my $start = time;
  my $mtime = mtime($f);
  sleep($n);
  while($mtime != mtime($f)) {
    #print "(waiting for $f to stop changing)\n";
    $mtime = mtime($f);
    sleep($n);
  }
  return time - $start - $n;
}

