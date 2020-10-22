#!/usr/bin/env mash
(* Command-line interface to BeeBrain. The php wrapper writes a .bb file
   which the daemon notices and calls this script with. *)

If[Length[ARGV]<2,
  prn["USAGE: ",ARGV[[1]]," bbfile"];
  prn["  (NB: Have to do export DISPLAY=:250 -- we have a virtual X server ",
      "running there.\n   Currently, DISPLAY = ", Environment["DISPLAY"], ")"];
  Exit[1]];

(* Infer whether we're in production or test environment and set path. *)
pathfunc[_] := (Print["WARNING: Setting path to cwd."]; "./");
pathfunc["kibotzer"] = pathfunc["yootles"] = "/var/www/html/kibotzer/";
pathfunc["danny"] = pathfunc["dreev"]= "/Users/dreeves/prj/beeminder/beebrain/";
path = pathfunc[$MachineName];
Get[path<>"beemlib.m"];

bbfile = ARGV[[2]];
tmp = StringCases[bbfile, re@"^(.*?)([^\\/]+)\\.bb$" -> {"$1","$2"}];
If[tmp==={}, prn["ERROR: ",bbfile," not a bbfile"]; Exit[1]];
{base, slug} = tmp[[1]];

prn["BEEBRAIN START: ",base,slug," @ ",shdt@tm[]];
imgf = base<>slug<>".png";
thmf = base<>slug<>"-thumb.png";
(* Now make sure the images 404 until they're ready... *)
imgftmp = paratempfile[imgf];
thmftmp = paratempfile[thmf];
If[FileExistsQ[imgf], RenameFile[imgf, imgftmp]];
If[FileExistsQ[thmf], RenameFile[thmf, thmftmp]];

{params, datac} = parseBB@slurp[bbfile];

stats = genStats[params, datac];
statstm = tm[];
pr[StringReplace[statsum,"\\n"->"\n"]];
stats = Join[stats, {"graphurl" -> "http://kibotzer.com/"<>imgf,
                     "thumburl" -> "http://kibotzer.com/"<>thmf}];
spew[base<>slug<>".json", genJSON[stats]];

p = genGraph[];
graphtm = tm[];
genImage[p, imgftmp];        RenameFile[imgftmp, imgf];
genThumb[p, imgf, thmftmp];  RenameFile[thmftmp, thmf];

donetm = tm[];
tottime = tm[]-proctm;
prn["BEEBRAIN DONE in ",
    shn[donetm-proctm, 1,3], " seconds (",
    shn[statstm-proctm, 1,3]," stats + ",
    shn[graphtm-statstm, 1,3]," graph + ",
    shn[donetm-graphtm, 1,3], " stupidity)."];
