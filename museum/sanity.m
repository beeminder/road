#!/usr/bin/env mash
(* Sanity checker for beebrain. If sanity.txt exists, see if we match, otherwise
   create it. *)

(* Infer whether we're in production or test environment and set path. *)
pathfunc[_] := (Print["WARNING: Setting path to cwd."]; "./");
pathfunc["kibotzer"] = pathfunc["yootles"] = "/var/www/html/kibotzer/";
pathfunc["danny"] = pathfunc["dreev"]= "/Users/dreeves/prj/beeminder/beebrain/";
path = pathfunc[$MachineName];
Get[path<>"beemlib.m"];

(* process a bb file and return the stats *)
proc[file_] := Module[{params, data},
  {params, data} = parseBB@slurp[file];
  genStats[Join[{}, params], data]]

sh3 = shn[Chop[#], 2,4]&;  (* originally 3,5 then 2,4 for python comparison *)

asciify[x_] := cat[x]
asciify[s_String] := StringReplace[s, {FromCharacterCode[8734]->"inf",
                                       FromCharacterCode[9786]->":)"}]

(* a terrible way to do an ascii sort but seems to work *)
asciisort[sl_List] := FromCharacterCode /@ 
  SortBy[ToCharacterCode /@ sl, FromDigits[PadRight[#, 100], 123]&]

serialize[file_] := Module[{p,d, s, w1=16, i1, i2, a, deltas},
  {p, d} = parseBB@slurp[file];
  s = genStats[Join[{}, p], d];
  i1 = cat@@ConstantArray[" ", w1];
  a = StringTake[StringReplace[file, {re@"^data/"->"", 
                                      re@"\\.bb"->"", 
                                      "+"->"/"}]<>i1, w1]<>" ";
  i2= "          ";
  cat[cat@@ConstantArray["-", 40]," ",file," ",cat@@ConstantArray["-", 40],"\n",
    a,"gldt:     ",shd@gldt,"\n",
    a,"goal:     ",sh3@goal,"\n",
    a,"rate:     ",sh3@rate,"\n",
    a,"road:     ",
      cat@@Riffle[{shd@#1,sh3@#2,sh3@#3}& @@@ road, "\n"<>a<>i2],"\n",
    a,"edgy:     ",edgy,"\n",
    a,"noisy:    ",noisy,"\n",
    a,"steppy:   ",steppy,"\n",
    a,"rosy:     ",rosy,"\n",
    a,"movingav: ",movingav,"\n",
    a,"aura:     ",aura,"\n",
    a,"aggday:   ",aggday,"\n",
    a,"waterbuf: ",asciify[waterbuf],"\n",
    a,"waterbux: ",waterbux,"\n",
    a,"t0:       ",shd[t0],"\n",
    a,"v0:       ",sh3[v0],"\n",
    a,"tz:       ",shd[tz],"\n",
    a,"vz:       ",sh3[vz],"\n",
    a,"tg:       ",shd[tg],"\n",
    a,"vg:       ",sh3[vg],"\n",
    a,"t0d:      ",shd[t0d],"\n",
    a,"v0d:      ",sh3[v0d],"\n",
    a,"tzd:      ",shd[tzd],"\n",
    a,"vzd:      ",sh3[vzd],"\n",
    a,"siru:     ",sh3[siru],"\n",
    a,"avgrt:    ",sh3[avgrt],"\n",
    a,"zrate:    ",sh3[zrate],"\n",
    a,"lnw:      ",sh3[lnw],"\n",
    a,"delta:    ",sh3[delta],"\n",
    a,"rah:      ",sh3[rah],"\n",
    a,"lane:     ",lane,"\n",
    a,"color:    ",color,"\n",
    a,"safebuf:  ",safebuf,"\n",
    a,"cntdn:    ",cntdn,"\n",
    a,"numpts:   ",numpts,"\n",
    a,"loser:    ",loser,"\n",
    a,"losedate: ",shd@losedate,"\n",
    a,"lanesum:  ",lanesum,"\n",
    a,"ratesum:  ",ratesum,"\n",
    a,"limsum:   ",limsum,"\n",
    (*a,"graphsum: ",graphsum,"\n",*)
    (*a,"headsum:  ",headsum,"\n",*)
    (*a,"titlesum: ",titlesum,"\n",*)
    (*a,"progsum:  ",progsum,"\n",*)
    a,"statsum:  ",StringReplace[StringDrop[statsum,-2],
                                 "\\n"->"\n"<>a<>i2],"\n"
    (*a,"deltas:   ",
      cat@@Riffle[cat /@ Partition[{shd@#1, sh3[#2-rdf[#1]]}& @@@ d, 4],
                  "\n"<>a<>i2], "\n"*)]]

(* cat@@Riffle[sh3[#2-rdf[#1]]& @@@ d, ", "],"\n"]] *)

start = tm[];
motherlode = cat @@ (serialize /@ asciisort@FileNames["data/*.bb"]);
end = tm[];

If[FileExistsQ["sanity.txt"],
  If[StringTrim@motherlode == StringTrim@slurp["sanity.txt"],
    prn["SANE!  Execution time: ",shn[end-start,1,5],"s"];
    system["~/prj/tagtime/sound/playsound sigh.wav"];
  , 
    system["~/prj/tagtime/sound/playsound loud-uh-oh.wav"];
    spew["insanity.txt", motherlode];
    dn = StringTrim@backtick["diff sanity.txt insanity.txt | wc -l"];
    prn["INSANE IN THE MEMBRANE! diff insanity.txt sanity.txt | wc -l => ",dn];
  ]
, prn["No sanity.txt file found; creating it"];
  spew["sanity.txt", motherlode]];
