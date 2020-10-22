(* BeeBrain: The Brains of Beeminder
The main functions this library provides are genStats and genGraph.
The genStats function has to be called first because in addition to returning
the stats for a goal, it sets global variables (see pin and pout) which genGraph
depends on. *)

(* The 'edgy' parameter:  Following a YBR means making a certain amount of 
progress each day. But does that include the initial day?  For weightloss it
doesn't. Your initial weight is your starting point -- it determines the start
of (the centerline of) the YBR -- and if you follow your road perfectly you drop
to hit the centerline again the next day.
But now consider a goal like "do 10 pushups a day". The initial point is today
with a value of zero. To stay perfectly on your road you need to do the 10 
pushups today to go from the bottom edge to the centerline. Generally kyoom and
odom graphs are 'edgy'.
What edgy means specifically is that we want the initial point to be on the 
bottom (or top, depending on yaw) edge of the road. That means moving the start
of the road up (or down) by one lane width compared to where it would be if it 
started at the initial datapoint.
But we have a chicken and egg problem: We need the road function in order to
compute the lane width and we need the initial point, (t0,v0), to compute the 
road function. In other words, we need (t0,v0) to compute the lane width but we
need the lane width to compute (t0,v0), to shift it.
Solution (sort of): The lane width is generally equal to the daily rate of the
road. So we can have the road start at the initial datapoint but one day 
earlier. Ie, (t0,v0) -= (SID,0). Then when we know the road function we can move
t0 forward a day and v0 by the appropriate amount, v0 = rdf(t0+SID).
The only problem with this approach is that it only puts the initial datapoint 
at the edge if the rate of the first segment of the road is the same as the rate
of the most recent datapoint, since it's the rate there that determines
the overall lane width. 
Trying to do this Really Right gets very messy or even impossible without 
introducing worse problems than the initial point not being on the actual edge.
*)

(* The 'asof' parameter: Takes either a unix time or null.
Case asof==null:
  Show all data and flatline up to today if the last datapoint is in the past.
Case asof!=null:
  Throw away any data after asof and flatline up to asof if the remaining last 
  datapoint is before asof. (In other words, exactly what the graph looked like 
  as of asof, assuming there was no prescient data entry.)
So the two cases are almost the same when asof==now except for the "assume no 
prescient data entry" part. Ie, asof=now throws away future data. *)

(* Possible future feature: Specify road reset dates and make the YBR 
discontinuously jump to match the datapoint on that date, or, if no datapoint 
then f(prev,next) where f = Min if rate > 0 else Max. Road reset dates are 
ignored if no data. *)

(* Idea for better exponential moving average that takes into account gaps:
   http://stackoverflow.com/questions/1023860 *)

(* Candidate new params:
o floaty (default true) for whether it makes sense to give deltas and bare mins 
   and hard caps as decimals or only as integers. 
o mono (default false) for whether the data is necessarily strictly monotone.
*)

(* In-params and out-params are documented at http://eth.pad/beebrain *)

(* In-params: Graph settings and their defaults. *)
pin = ReleaseHold[Hold@{ (* for specifying param names as bare words *)
 gldt     -> Null,  (* Goal date given as {y, m, d} list; end of the YBR *)
 goal     -> Null,  (* The actual value being targeted; any real value *)
 rate     -> Null,  (* Amt the road should go up by (may be <0) per unit time *)
 road     -> {},    (* List of {endTime,goal,rate} triples *)
 runits   -> "w",   (* One of "y", "m", "w", "d", "h" *)
 exprd    -> False, (* Interpret rate as fractional, not absolute, change *)
 reset    -> Null,  (* Ignore data before this date, as if it never happened *)
 asof     -> Null,  (* Show the graph as it would've appeared on this date *)
 kyoom    -> False, (* Cumulative; whether to transform data with Accumulate *)
 odom     -> False, (* Treat zeros as accidental odom resets *)
 abslnw   -> Null,  (* Override road width algorithm with a fixed lane width *)
 edgy     -> False, (* Initial point on the road edge instead of centerline *)
 noisy    -> False, (* Compute road width based on data, not just road rate *)
 aggday   -> "all", (* all/last/first/min/max/mean/median/mode/trimmean *)
 plotall  -> True,  (* Plot all the points instead of just the aggregated pt *)
 yaw      -> 0,     (* Which side of the YBR you want to be on, 1 or -1 *)
 dir      -> 0,     (* Which direction you'll go (usually same as yaw) *)
 steppy   -> False, (* Join dots with purple steppy-style line *)
 rosy     -> False, (* Show the rose-colored dots and connecting line *)
 movingav -> False, (* Show moving average line superimposed on the data *)
 aura     -> False, (* Show blue-green/turquoise aura/swath *)
 stathead -> True,  (* Whether to include a label with stats at top of graph *)
 yaxis    -> "",    (* Label for the y-axis, eg, "kilograms" *)
 zfill    -> False, (* Graph days with no reported data as zeros *)
 tagtime  -> False, (* Whether the data is derived from tagtime *)
 nytz     -> 0,     (* Time zone relative to server time; hours offset wrt NY *)
 imgsz    -> 760,   (* ImageSize option. Width in pixels. *)
 waterbuf -> Null,  (* Watermark on the good side of the YBR; safebuf if null *)
 waterbux -> "",    (* Watermark on the bad side, ie, pledge amount *)
 sendmail -> True,  (* Email the person that their graph has been updated *)
 email    -> "",    (* Email address to send update to when graph's generated *)
 usr      -> "BOB", (* Username *)
 graph    -> "FOO"  (* Graph name, ie, slug *)
} /. (sym_->e_) :> (SymbolName@Unevaluated[sym]->e)];

(* Out-params: Fields to output, along with filled-in graph settings above. *)
pout = ReleaseHold[Hold@{ (* for specifying param names as bare words *)
 t0     -> Null, (* The coordinates (t0,v0), a (timestamp,value) pair,        *)
 v0     -> Null, (*   specify the start of the Yellow Brick Road.             *)
 tz     -> Null, (* Similarly, (tz,vz) gives the most recent datapoint, which *)
 vz     -> Null, (*   the YBR extends a little bit beyond.                    *)
 tg     -> Null, (* And {tg,vg} is the end of the YBR, the target             *)
 vg     -> Null, (*   that's a week or so out from (tz,vz).                   *)
 t0d    -> Null, (* The actual first datapoint, which is the same as (t0,v0)  *)
 v0d    -> Null, (*   unless edgy is true or there's a weightloss leniency.   *)
 tzd    -> Null, (* The last actually entered datapoint, but note that most   *)
 vzd    -> Null, (*   of beebrain actually cares about (tz,vz).               *)
 siru   -> Null, (* Seconds in rate units, eg: runits=="d" => 86400 *)
 avgrt  -> Null, (* Overall rate from (t0,v0) to (gldt,goal) *)
 zrate  -> Null, (* Rate at time tz *)
 lnw    -> 0,    (* Lane width at time tz *)
 delta  -> 0,    (* How far from centerline: vz - rdf[tz] *)
 rah    -> 0,    (* The y-value of the centerline of YBR at the akrasia horiz *)
 lane   -> 666,  (* What lane we're in; below=-2,bottom=-1,top=1,above=2,etc *)
 color  -> "",   (* One of {"green", "blue", "orange", "red"} *)
 safebuf-> Null, (* Number of days of safety buffer *)
 cntdn  -> 0,    (* Countdown: number of days from tz till we reach the goal *)
 numpts -> 0,    (* Number of real datapoints entered, before munging *)
 proctm -> 0,    (* Timestamp when genStats was last called *)
 statsum-> "",   (* Human-readable summary of graph statistics *)
 lanesum-> "",   (* Interjection like "wrong lane!" *)
 ratesum-> "",   (* Text saying what the rate is *)
 limsum -> "",   (* Text saying your bare min or hard cap *)
 deltasum->"",   (* Text saying where you are wrt the centerline *)
 graphsum->"",   (* Text at the top of the graph image; see stathead *)
 headsum-> "",   (* Text in the heading of the graph page *)
 titlesum->"",   (* Title text for graph thumbnail *)
 progsum-> "",   (* Text summarizing percent progress *)
 loser  ->False, (* Whether you're irredeemably off the road *)
 losedate->Null, (* The date at which you irredeemably lost or will lose *)
 error  -> ""    (* Empty string if no errors generating graph *)
} /. (sym_->e_) :> (SymbolName@Unevaluated[sym]->e)];

(* Input parameters to ignore; complain about anything not here or in pin. *)
pignore = ReleaseHold[Hold@{ (* ridiculous trick to specify them as barewords *)
 gunit, ztoday, name, blurb, timezone, wrimo, wloss, recruitedBy, email2
}/.s_Symbol/;s=!=Hold&&s=!=List:>SymbolName@Unevaluated@s];

Off[Power::"infy"];
Off[Infinity::"indet"];

(******************************************************************************)
(********************************** CONSTANTS *********************************)

RGB  = RGBColor;
PLON = 60; (* number of plotpoints for RegionPlot; Automatic wasn't cuttin it *)
PRAL = PlotRange->All;
PTSZ = PointSize;
THCK = Thickness;
JOIN = Joined->True;

DYEL = Lighter[Yellow, .55]; (* originally DYEL,LYEL = .6,2/3 then .57,.68 *)
LYEL = Lighter[Yellow, .68]; (* then .55,.70 ... *)
ROSE = RGB[1, 0.5, 0.5];     (* originally 1,1/3,1/3 then 251,130,199 *)
PURP = Lighter[Purple, .42];
BLUE = Lighter[Blue, .918];
GRUE = Lighter[Green, .832];
BLCK = Black;
GRNDOT = RGB[0,.67,0];   (* dark green for good side of the road; was .5 *)
BLUDOT = RGB[.25,.25,1]; (* blue for correct lane; was .2/.2/1 *)
ORNDOT = RGB[1,.65,0];   (* orange for wrong lane *)
REDDOT = RGB[1,0,0];     (* red for off the road on the bad side *)
YELDOT = DYEL;           (* yellow for off the road in the past *)

ASP = 5/8;   (* ASPect ratio, common for monitors, eg, 2560x1600, 1440x900 *)
DIY = 365.25; (* this is what physicists use, eg, to define a light year *)
SID = 86400; (* seconds in a day *)
PING = 3/4;  (* reciprocal of tagtime's rate parameter, in hours *)
UPOCH = 2208974400; (* unix time 0 is this in mma's absolutetime *)
(* UPOCH = 2208974400 - 4*3600;  for portland, or something? *)
HORIZ = 14*SID; (* how far beyond (tz,vz) to show the bull's eye; ahorizon*2 *)

(******************************************************************************)
(****************************** GLOBAL VARIABLES ******************************)

data;  (* List of {timestamp,value} pairs, one value per day *)
vals;  (* Maps timestamp to list of values on that day; cf aggday=all *)
val1;  (* Maps timestamp to the single aggregated value on that day *)
tp;    (* The p is really like a -1. Ie, {tp,vp} is the point, if any, *)
vp;    (*   before {t0,v0}. Sometimes needed to establish YBR start.   *)
rdf;   (* Pure function mapping timestamp to the y-value of the YBR *)
rtf;   (* Maps timestamp to YBR rate, ie, derivative of road func wrt time *)
lnf;   (* Maps timestamp to lane width, not counting noisy width *)
nw;    (* Noisy width; true lane width is this maxed with lnf *)
dtf;   (* Maps timestamp to most recent data value *)
ymin;  (* The bounds for the graph -- the corresponding xmin and xmax are *)
ymax;  (*   just t0 and tg.                                               *)

If[cmdline===False,
(******************************** From mash.pl ********************************)
ARGV = args = Drop[$CommandLine, 4];        (* Command line args.             *)
pr = WriteString["stdout", ##]&;            (* More                           *)
prn = pr[##, "\n"]&;                        (*  convenient                    *)
perr = WriteString["stderr", ##]&;          (*   print                        *)
perrn = perr[##, "\n"]&;                    (*    statements.                 *)
re = RegularExpression;                     (* I wish mathematica weren't     *)
EOF = EndOfFile;                            (*   so damn verbose!             *)
read[] := InputString[""];                  (* Grab a line from stdin.        *)
readList[] := Most@                         (* Grab the list of all the lines *)
  NestWhileList[read[]&, read[], #=!=EOF&]; (*  from stdin.                   *)
cat = StringJoin@@(ToString/@{##})&;        (* Like sprintf/strout in C/C++.  *)
eval = ToExpression[cat[##]]&;              (* Like eval in every other lang. *)
slurp = Import[#, "Text"]&;                 (* Fetch contents of file as str. *)
system = Run@cat@##&;                       (* System call.                   *)
backtick = Import[cat["!", ##], "Text"]&;   (* System call; returns stdout.   *)
                                            (* ABOVE: mma-scripting related.  *)
keys[f_, i_:1] :=                           (* BELOW: general utilities.      *)
  DownValues[f, Sort->False][[All,1,1,i]];  (* Keys of a hash/dictionary.     *)
SetAttributes[each, HoldAll];               (* each[pattern, list, body]      *)
each[pat_, lst_List, bod_] :=               (*  converts pattern to body for  *)
  (Cases[Unevaluated@lst, pat:>bod]; Null); (*   each element of list.        *)
each[p_, l_, b_] := (Cases[l, p:>b]; Null); (*    (Warning: eats Return[]s.)  *)
some[f_, l_List] := True ===                (* Whether f applied to some      *)
  Scan[If[f[#], Return[True]]&, l];         (*  element of list is True.      *)
every[f_, l_List] := Null ===               (* Similarly, And @@ f/@l         *)
  Scan[If[!f[#], Return[False]]&, l];       (*  (but with lazy evaluation).   *)
(******************************************************************************)
];

(******************************************************************************)
(*************** GENERAL UTILITIES (not specific to Beeminder) ****************)

(* Render s (a string or like Style["xyz", Bold, "Title"] or an image) to fill a
   rectangle with left/bottom corner {l,b} and right/top corner {r,t}. 
   Cf http://stackoverflow.com/q/8178257/make-a-text-string-fill-a-rectangle *)
rendrect[s_, {{l_,b_},{r_,t_}}] := Graphics@Inset[
  Pane[s, Scaled/@{1,1}, ImageSizeAction->"ResizeToFit", Alignment->Center],
  {l, b}, {Left, Bottom}, {r-l, t-b}]

(* Return an element x of domain dom for which f[x] is maximal. *)
argMax[f_, dom_List] := Module[{g},
  g[e___] := g[e] = f[e]; (* memoize *)
  First@dom[[Ordering[g/@dom, -1]]]]

(* Takes a file and returns a parallel temp file, ie, with the directory and
   file extension the same but with the base file name amended with a unique 
   string based on the Mathematica session ID.  Eg, foo.x -> foo-tmp743829.x *)
paratempfile[f_] := StringReplace[f, re@"^(.*)\\.([^\\.]*)$" -> 
                                     cat["$1-tmp", $SessionID, ".$2"]]

(* Write stuff to a file. Kinda like Put but doesn't print quotes on strings. *)
spew[fn_, stuff___] := With[{s= OpenWrite[fn]}, WriteString[s, stuff]; Close[s]]

Unprotect[Clip];     (* strange that Clip doesn't know this already... *)
Clip[-Infinity, {a_,_}] := a
Clip[Infinity,  {_,b_}] := b
Protect[Clip];

(* Show Number. Convert to string w/ no trailing dot. Use at most d significant
   figures after the decimal point. Target t significant figures total (clipped
   to be at least i and at most i+d, where i is the number of digits in integer
   part of x). Can also specify explicit prefix strings for positive and 
   negative numbers, typically for when you want an explicit plus sign in front
   positive numbers, like for specifying a delta. *)
Off[NumberForm::"sigz"]; (* ~10^100 in non-scientific notation complains o.w. *)
shn[x_, d_:5, t_:16, s_:{"-",""}] := If[!NumericQ[x], cat[x],
  With[{i= IntegerLength@IntegerPart@x},
    StringReplace[ToString@NumberForm[N@x, Clip[t, {i,i+d}],
                                     ExponentFunction->(Null&), NumberSigns->s],
                  re@"\\.$"->""]]]
shns[x_, d_:5, t_:16] := shn[x, d, t, {"-","+"}]

(* Show Date. Note DateString can't handle absolute times that aren't floats. *)
shd[x_]  := DateString[If[NumericQ@x, N@x, x], {"Year",".","Month",".","Day"}]
shdt[x_] := DateString[If[NumericQ@x, N@x, x], 
           {"Year",".","Month",".","Day", " ","Hour",":","Minute",":","Second"}]
shd[Null]  = "Null";
shdt[Null] = "Null";

(* Parse JSON into the Mma equivalent with rules and lists. *)
Off[Syntax::"stresc"] (* else complains "unknown string escape \u" in a/job *)
parseJSON[json_] := eval@StringReplace[cat@FullForm@eval[StringReplace[json,
    {"["     -> "(*MAGIC[*){",
     "]"     -> "(*MAGIC]*)}",
     ":"     -> "(*MAGIC:*)->",
     "true"  -> "(*MAGICt*)True",
     "false" -> "(*MAGICf*)False",
     "null"  -> "(*MAGICn*)Null",
     "e"     -> "(*MAGICe*)*10^",
     "E"     -> "(*MAGICE*)*10^"}]],
    {"(*MAGIC[*){"     -> "[",
     "(*MAGIC]*)}"     -> "]",
     "(*MAGIC:*)->"    -> ":",
     "(*MAGICt*)True"  -> "true",
     "(*MAGICf*)False" -> "false",
     "(*MAGICn*)Null"  -> "null",
     "(*MAGICe*)*10^"  -> "e",
     "(*MAGICE*)*10^"  -> "E"}]

(* The inverse of parseJSON. Cf stackoverflow.com/q/2633003 *)
genJSON[a_ -> b_]  := genJSON[a] <> ":" <> genJSON[b]
genJSON[{x__Rule}] := "{" <> cat @@ Riffle[genJSON /@ {x}, ", "] <> "}"
genJSON[{x___}]    := "[" <> cat @@ Riffle[genJSON /@ {x}, ", "] <> "]"
genJSON[Null]      := "null"
genJSON[True]      := "true"
genJSON[False]     := "false"
genJSON[x_]        := shn[x] /; NumberQ[x]  (* CForm better? *)
genJSON[x_]        := "\"" <> StringReplace[cat[x], "\""->"\\\""] <> "\""

(* Generalization of Chop to replace near-integers with integers. *)
ichop[x_, delta_:10^-10] := IntegerPart@x + 
  If[FractionalPart@x < 0.5, Chop[FractionalPart@x, delta], 
                             1-Chop[1-FractionalPart@x, delta]]

(* Mostly an alias for AbsoluteTime, but slightly more robust. Also defaults to
   noon instead of midnight becuase of this: 
     http://stackoverflow.com/q/5794401 *)
tm[] := AbsoluteTime[]
tm[y_, m_, d_Integer, h_:12, mn_:0, s_:0] := AbsoluteTime[{y, m, d, h, mn, s}]
tm[y_, m_, d_] := AbsoluteTime[{y, m, d}] (* allows fractional days *)
tm[d_List] := tm @@ d
tm[d_String] := Check[AbsoluteTime[d], prn["ERRORtm: ",d,"\n"]; Exit[1]]
tm[d_] := d  (* if it's a number or Null, leave it *)

(* SCHDEL: before changing to default to noon: [SCHDEL = scheduled for deletion]
tm[] := AbsoluteTime[]
tm[d_List] := AbsoluteTime[d]
tm[d_String] := Check[AbsoluteTime[d], prn["ERRORtm: ",d,"\n"]; Exit[1]]
tm[d_] := d 
*)

(* Singular or Plural:  Pluralize the given noun properly, if n is not 1. 
   Provide the plural version if nonstandard.
   Eg: splur[3, "boy"] -> "3 boys", splur[3, "man", "men"] -> "3 men" *)
splur[n_, noun_]         := cat[shn@n, " ", noun, If[n===1 || n==="1", "", "s"]]
splur[n_, noun_, plural_] := cat[shn@n, " ", If[n===1 || n==="1", noun, plural]]

(* Send email. All arguments are just cat'd together and piped to sendmail. *)
(* Should probably replace this with the built-in SendMail function. *)
mail[stuff___] := Module[{stream},
  stream = OpenWrite["!/usr/sbin/sendmail -oi -t"];
  WriteString[stream, stuff];
  Close[stream]]

(* Convex combination: x rescaled to be in [c,d] as x ranges from a to b. *)
cvx[x_, {a_,a_}, {c_,d_}, clipQ_:True] := If[x <= a, Min[c,d], Max[c,d]]
cvx[_, {a_,b_}, {c_,c_}, clipQ_:True] := c
cvx[x_, {a_,b_}, {c_,d_}, clipQ_:True] := 
  Which[Chop[a-b]==0, cvx[x, {a,a}, {c,d}],
  True, If[clipQ, Clip[Rescale[x,{a,b},{c,d}], Sort@{c,d}], 
                  Rescale[x,Sort@{a,b},Sort@{c,d}]]]

(* Takes a list of datapoints sorted by x-value and returns a pure function that
   interpolates a step function from the data, always mapping to the most recent
   value. Cf http://stackoverflow.com/q/6853787 *)
stepify[{},    default_:0] := (default&)
stepify[data_, default_:0] := With[{
    x0 = data[[1,1]],   (* return default if < x0 *)
    x9 = data[[-1,1]],  (* return y9 if >= x9 *)
    y9 = data[[-1,2]],
    f = Interpolation[{-1,1}*#& /@ data, InterpolationOrder->0]},
  Which[# < x0, default, # >= x9, y9, True, f[-#]]&]

(* Takes a date/time and returns the date/time of noon on that day. *)
daysnap[{y_, m_, d_}]  := {y, m, Floor@d, 12}
daysnap[t_List]        := daysnap@Take[t, 3]
daysnap[t_]            := tm@daysnap@DateList@t
daysnap[Null]          =  Null;

(* Like daysnap but floors the date/time back to midnight. Note that tm[] 
   defaults to noon so we have to use AbsoluteTime[]. *)
dayfloor[{y_, m_, d_}]  := {y, m, Floor@d}
dayfloor[t_List]        := dayfloor@Take[t, 3]
dayfloor[t_]            := AbsoluteTime@dayfloor@DateList@t
dayfloor[Null]          =  Null;

(* SCHDEL: dayfloor[t_List]        := DateList@AbsoluteTime@Take[t, 3] *)
(* SCHDEL: the version before changing the tm function:
dayfloor[{y_}]        := DateList@tm@{y}
dayfloor[{y_,m_}]     := DateList@tm@{y, m}
dayfloor[{y_,m_,d_}]  := {y, m, Floor@d}
dayfloor[t_List]      := DateList@tm@Take[t, 3]
dayfloor[t_]          := tm@dayfloor@DateList@t
dayfloor[Null]        =  Null;
*)

(* Plus 1 Year *)
p1y[t_] := (*dayfloor@*)tm[DateList[t]+{1,0,0,0,0,0}]

secs["y"] = DIY*SID;       unam["y"] = "year";
secs["m"] = DIY/12*SID;    unam["m"] = "month";
secs["w"] = 7*SID;         unam["w"] = "week";
secs["d"] = SID;           unam["d"] = "day";
secs["h"] = 3600;          unam["h"] = "hour";
secs[_]   = -666;          unam[_]   = "UNKNOWN_TIME_UNIT";

(******************************************************************************)
(************************ GENERAL BEEMINDER UTILITIES *************************)

(* Fill in the missing y-value in the middle datapoint by interpolating 
   linearly between the points it's sandwiched between. *)
sandwich[{t0_, v0_}, {t_, Null}, {t1_, v1_}] := {t, cvx[t, {t0, t1}, {v0, v1}]}
sandwich[{_, _}, x_, {_, _}] := x (* not necessary but maybe more efficient *)

(* Good delta: Returns the delta from the given point to the centerline of the 
   road but with the sign such that being on the yaw side of the road gives a 
   positive delta and being on the wrong side gives a negative delta.  *)
gdelt[{t_,v_}] := Chop[yaw*(v-rdf[t])]

(* The bottom lane is -1, top lane is 1, below the road is -2, above is +2, etc.
   If the road steepness is constant and the graph is not noisy then a positive
   lane number is the same as the safety buffer. 
   Implementation notes:
   This includes the noisy width but it does not adjust the noisy width based 
   on t. So this gives the correct lane number for noisy graphs when called 
   with {tz,vz} but not necessarily for other values of t. The getSafebuf 
   function handles this slightly more robustly. Unless we deal with the noisy 
   width better we might want to remove the {t,v} parameter and have this only 
   work for {tz,vz}.
   How to use lanage:
    lanage*yaw >= -1: on the road or on the good side of it
    lanage*yaw >   1: completely on the good side of the road (green dot)
    lanage*yaw == -1: wrong lane (orange dot)
    lanage*yaw == -2: beemergency (red dot)
    lanage*yaw <  -2: irredeemably off the road (red dot)
*)
lanage[{t_,v_}, l_] := Module[{d = v - rdf[t], x},
  If[Chop[l]==0, Return@If[Chop[d]==0, yaw, Sign[d]*666]]; 
  x = ichop@N[d/l];
  If[IntegerQ[x],
    If[yaw>0 && x >= 0,  Return[x+1]];
    If[yaw<0 && x <= 0,  Return[x-1]]];
  Sign[x]*Ceiling@Abs[x]]
lanage[{t_,v_}] := lanage[{t,v}, If[noisy, Max[nw, lnf[t]], lnf[t]]]

(* Whether the given point is on the road if the road has lane width l. *)
aok[{t_,v_}, l_] := lanage[{t,v}, l] * yaw >= -1

(* SCHDEL: Chop[gdelt[{t,v}] + l] >= 0 *)

(* SCHDEL: original lanage function with no l param:
Module[{d = v - rdf[t], l, x},
  l = If[noisy, Max[nw, lnf[t]], lnf[t]];
  If[l==0, Return@If[Chop[d]==0, yaw, Sign[d]*666]]; 
  x = ichop@N[d/l];
  If[IntegerQ[x],
    If[yaw>0 && x >= 0,  Return[x+1]];
    If[yaw<0 && x <= 0,  Return[x-1]]];
  Sign[x]*Ceiling@Abs[x]]
*)


(* Rate as a string, shown as a percentage if exprd is true. *)
shr[r_] := shn[If[exprd,100,1]*r,2,4]<>If[exprd,"%",""]

(* Shortcuts for common ways to show numbers. *)
sh1  = shn[ Chop[#], 2,4]&;
sh1s = shns[Chop[#], 2,4]&;

(* The value of the relevant/critical edge of the YBR in n days. *)
lim[n_] := With[{t = tz+SID*n}, 
                rdf[t] - Sign[yaw]*If[noisy, Max[nw,lnf[t]], lnf[t]]]
(* SCHDEL: Which[yaw>0, -lnw, yaw<0, lnw, True, 0] *)

(******************************************************************************)
(******************** TRANSLATING INTO AND OUT OF BEEBRAIN ********************)

(* Parse a JSON string with params and data, the way it's provided to Beebrain
   in the .bb file.  Returns {params, data} where params is a list of rules like
     {"foo" -> "abc", "bar" -> {1,2,3}}
   and data is a list of {timestamp,value} pairs.
   We convert all unixtimes to mma epoch time. NB: No longer sorting them. *)
parseBB[_] = {{}, {}};
parseBB[json_String] := Module[{params, data},
  {params, data} = {"params", "data"} /. parseJSON[json];
  params = transin[params];
  data = Prepend[Rest[#], First[#]+UPOCH]& /@ data;
  {params, data}]

(* Convert from unixtime to mma's epoch time *)
timein = If[NumberQ@#, #+UPOCH, #]&;

(* Convert a mma timestamp to unixtime, at noon *)
timeout = Which[NumericQ@#, Round[daysnap@#-UPOCH], 
                ListQ@#,    Round[tm@daysnap@#-UPOCH], 
                True,       #]&;

(* Convert a number from mma to something that JSON can handle *)
numout = If[NumericQ@#, N@#, #]&;

(* Mainly convert timestamps from unixtime when inputting parameters as JSON. *)
input[_] = Identity;
input["gldt"] = input["reset"] = input["asof"] = timein;
input["road"] = (Function[{t,v,r}, {timein[t], v, r}]@@@#&);

(* Mainly convert timestamps to unixtime when outputting parameters as JSON. *)
output[_] = numout;
output["gldt"] = output["reset"] = output["asof"] = 
output["t0"] = output["t0d"] = output["tz"] =  output["tzd"] = output["tg"] = 
output["losedate"] = timeout;
output["proctm"] = Round[#-UPOCH]&; (* don't daysnap proctm *)
output["road"] = (Function[{t,v,r}, {timeout[t], numout[v], numout[r]}]@@@#&);
output["email"] = ("REDACTED"&);

(* Apply the input/output function to a list of param->value pairs. *)
transin[pairs_]  := #1->input[#1][#2]&  @@@ pairs
transout[pairs_] := #1->output[#1][#2]& @@@ pairs

(******************************************************************************)
(******************************* TRANSFORM DATA *******************************)

(* Set the global hash, vals, which maps a dayfloored timestamp (aka, a day) to
   the list of values entered for that day. Those lists will necessarily have 
   length one unless aggday==all. Also, additional datapoints may get inserted
   (like a dummy point for today, or reset); see the restoreVals function. *)
setVals[] := (Clear[vals]; vals[_] = {};
  each[{t_,vl_}, {#[[1,1]], #[[All,2]]}& /@ SplitBy[data, First], vals[t] = vl];
)

(* Takes data with one value per day and returns data with multiple points per
   day. This will have no effect unless aggday==all. *)
rv0[{t_, vl_}] := {t,#}& /@ vl
restoreVals[data_] := (* addt'l pts may have been inserted with no vals entry *)
  Flatten[rv0 /@ ({#1, If[vals[#1]==={}, {#2}, vals[#1]]}& @@@ data), 1]

(* Takes data as {timestamp,value,comment} triples and returns a list of 
   strings corresponding to the canonical way you'd enter those datapoints. *)
can0[{t_,v_,c_}] := cat[ToLowerCase@DateString[t, 
  {(*"MonthNameShort",*)"Day"}]," ",shn@v, If[c==="","",cat[" \"",c,"\""]]]
can0[{t_,v_}] := cat[ToLowerCase@DateString[t, 
  {(*"MonthNameShort",*)"Day"}]," ",shn@v]
canonicalize[data_] := can0 /@ data

(* Whether the data passes sanity checks. Returns empty string if so, else an 
   error string describing the problem. This doesn't complain if data is the 
   empty list; that's checked elsewhere. *)
saneData[data_] := Module[{err, flag = False},
  each[i_, data,
    If[!flag && !MatchQ[i, {_?NumericQ, _?NumericQ, Repeated[_String,{0,1}]}],
      err = cat["Invalid datapoint: ",i];
      flag = True]];
  If[flag, Return@err];
  ""]

(* Given list of {tm,val} pairs, adjust timestamps to midnight *)
floorify[data_] := {dayfloor@#1, #2}& @@@ data

(* Returns a pure function that aggregates a list of values in the way indicated
   by the string s, which is what was passed in as the aggday param. *)
aggregator["all"]      = Identity;   (* all & last are equivalent except that *)
aggregator["last"]     = {Last@#}&;  (* aggday all means all datapoints are   *)
aggregator["first"]    = {First@#}&; (* plotted; the last datapoint is still  *)
aggregator["min"]      = {Min@#}&;   (* the official one when aggday==all.    *)
aggregator["max"]      = {Max@#}&;                    (* WAIT: aggday=last    *)
aggregator["truemean"] = {Mean@#}&;                   (*   doesn't work for   *)
aggregator["uniqmean"] = {Mean@DeleteDuplicates@#}&;  (*   kyoom graphs!      *)
aggregator["mean"]     = {Mean@DeleteDuplicates@#}&;  
aggregator["median"]   = {Median@#}&;
aggregator["mode"]     = {Median@Commonest@#}&;
aggregator["trimmean"] = {TrimmedMean[#, .1]}&;
aggregator["sum"]      = {Total@#}&;

(* Aggregate datapoints on the same day per the aggday parameter. *)
agg0[a_][d_]:= With[{x = d[[1,1]], y = aggregator[a][d[[All,2]]]}, {x,#}& /@ y]
aggregate[data_, a_:Null] := 
  Flatten[agg0[If[a===Null, aggday, a]] /@ SplitBy[data, First], 1]

(* Throw away all data before the given reset date, but save the last datapoint
   before the reset date, if it exists, as the global variables {tp,vp}. 
   Since you can only meaningfully start a graph with an initial datapoint
   (and reseting is the same as starting a graph) we have to make sure that
   there's a datapoint on the reset date. 
   For kyoom graphs we can just add {reset,0} if it doesn't already exist. 
   For non-kyoom graphs we add an interpolated point.
   This function changes the global data as a "side effect" and returns the
   number of datapoints after applying the reset, not counting the added point,
   if any. *)
applyReset[Null] := Length[data]
applyReset[r_] := Module[{extra, addflag = False, trashflag = False},
  If[!kyoom,
    If[r < data[[1,1]],  addflag = True;  PrependTo[data, {r, data[[1,2]]}]];
    If[r > data[[-1,1]], addflag = True;  AppendTo[ data, {r, data[[-1,2]]}]]];

  extra = Select[data, First@# < r&];
  If[extra=!={}, {tp,vp} = Last@extra];
  data = Select[data, First@# >= r&];
  
  If[kyoom && (data==={} || data[[1,1]] != r),  (* reset a kyoom graph  *)
    addflag = True;                             (* any time and it just *)
    PrependTo[data, {r,0}]];                    (* starts at zero then  *)

  (* Resetting non-kyoom graph on a day w/o datapt? Add an interpolated pt *)
  If[!kyoom && data[[1,1]] > r && tp=!=Null, 
    addflag = True;
    PrependTo[data, sandwich[{tp,vp}, {r,Null}, First@data]]];

  (* Filter road matrix by tossing all rows with an explicit time that's on or 
     before r, as well as any rows before them in the matrix.
     This implies a constraint on how BeeBrain is called: if you specify a reset
     date then you also have to make sure there are no road rows that end before
     that reset date or, if some row does end before the reset date, it or some
     row after it must have an explicit date.
     The Really Right way to handle this is to first fill in the road matrix as
     if there were no reset date specified and *then* filter the road matrix to
     toss all road rows that end on or before the reset date.
  *)
  road = Reverse@Select[Reverse@road, (If[#[[1]]=!=Null && 
                 dayfloor[#[[1]]]<=dayfloor@r, trashflag = True]; !trashflag)&];

  Length[data] - Boole[addflag]]

(* Insert a datapoint at the given time and with the same value as the previous
   datapoint. (If done before kyoomifying we'd insert an actual zero but this
   way we can do the same thing for both kyoom and non-kyoom graphs.) *)
insertZero[{}, t_] := {{t, If[vp===Null, 0, vp]}}
insertZero[data_, t_] := Module[{x},
  x = SplitBy[data, First@#<t&];
  Which[Length@x<2 && t<=data[[1,1]], Prepend[data, {t,0}],
        Length@x<2,                   Append[data, {t, data[[-1,2]]}],
        True,                         Join[First@x, {{t,x[[1,-1,2]]}}, Last@x]]]

(* For every day with no datapoint, add one with the same value as the previous
   datapoint. Do this after kyoomify, etc.
   Implementation note:
   This has a side effect of throwing away all but the last datapoint on each 
   day, which currently doesn't matter since we've ensured that there is only 
   one datapoint per day when we call this. *)
fillZeros[{}] = {};
fillZeros[data_] := Module[{val, a,b, x},
  each[{t_,v_}, data,  val[t] = v];
  {a,b} = Extract[data, {{1,1}, {-1,1}}];
  (If[NumericQ[val[#]], x = val[#]]; {#,x})& /@ Range[a,b, SID]]
        
(* Transform data so, eg, values {1,2,1,1} become {1,3,4,5} *)
kyoomify[{}] = {};
kyoomify[data_] := Transpose @ {#1, Accumulate@#2}& @@ Transpose@data
(* The inverse of kyoomify -- gives differences from previous datapoint. *)
unkyoomify[{}] = {};
unkyoomify[data_] := Transpose @ {#1, #2-Prepend[Most@#2,0]}& @@ Transpose@data
         (* Or: Transpose@{#1, Differences[Prepend[#2,0]]}& @@ Transpose@data *)

(* Transform data as follows: every time there's a decrease in value from one 
   datapoint to the next where the second value is zero, say {t1,V} followed by
   {t2,0}, add V to the value of every datapoint on or after t2. This is what 
   you want if you're reporting odometer readings (eg, your page number in a 
   book can be thought of that way) and the odometer gets accidentally reset (or
   you start a new book but want to track total pages read over a set of books).
   This should be done before kyoomify and will have no effect on data that has
   actually been kyoomified since kyoomification leaves no nonmonotonicities. *)
odo00[{prev_,offset_}, next_] := {next, offset + If[prev>next==0, prev, 0]}
odomify0[list_] := list + Rest[FoldList[odo00, {-Infinity,0}, list]][[All,2]]
odomify[{}] = {}
odomify[data_] := Transpose@{#1, odomify0[#2]}& @@ Transpose@data

(* Here's a version of the above that does that for *all* decreases, {t1,V} to
   {t2,v}, adding V to the value of every datapoint on or after t2.
   This is not currently used. It might be useful for a bartlebee/nanowrimo goal
   where you wanted to count total words added and not consider decreases in 
   wordcount to be backward progress toward the goal. Of course if the goal is
   to end up with a 50k-word document then you do want decreases to count as
   backward progress. *)
mon00[{prev_,offset_}, next_] := {next, offset + If[prev > next, prev, 0]}
monotonify0[list_] := list + Rest[FoldList[mon00, {-Infinity,0}, list]][[All,2]]
monotonify[data_] := Transpose@{#1, monotonify0[#2]}& @@ Transpose@data

(******************************************************************************)
(*********************** ROAD MATRIX AND ROAD FUNCTION ************************)

(* We should refactor the input parameters so that gldt,goal,rate are just 
provided as the last row of the road matrix and exactly 2 out of 3 of them must
be specified just like the other road matrix rows. *)

(* Given an initial point {t0,v0} and two out of three of {timestamp,value,
   rate(in seconds)} -- specified here as {t,v,r} -- return the third. *)
tvr[Null, _,  0,  t0_, _  ] := t0 + 15*DIY*SID (* special case: 100yrs hence *)
tvr[Null, _,  0., t0_, _  ] := t0 + 15*DIY*SID
tvr[Null, v_, r_, t0_, v0_] := If[exprd, t0 + Log[v/v0]/r, t0 + (v-v0)/r]
tvr[t_, Null, r_, t0_, v0_] := If[exprd, v0*Exp[r*(t-t0)], v0 + r*(t-t0)]
tvr[t_, v_, Null, t_,  v0_] := 0 (* special case: zero-width road segment *)
tvr[t_, v_, Null, t0_, v0_] := If[exprd, Log[v/v0]/(t-t0), (v-v0)/(t-t0)]

(* Clean up the road matrix, converting datelists to timestamps and rates to 
   amount per second. Also appends a row for the global gldt,goal,rate. *)
cleanRM[t_,v_,r_, m_] := 
  {dayfloor@tm@#1, #2, If[#3===Null, Null, #3/siru]}& @@@ Append[m, {t,v,r}]

(* Helper for genRdMtx for propagating forward filling in all the Nulls. *)
grm0[{t0_, v0_, _}, {t_, v_, Null}] := {t, v, tvr[t,v,Null, t0,v0]}
grm0[{t0_, v0_, _}, {t_, Null, r_}] := {t, tvr[t,Null,r, t0,v0], r}
grm0[{t0_, v0_, _}, {Null, v_, r_}] := {tvr[Null,v,r, t0,v0], v, r}

(* Fill in the road matrix. If there's more than one Null in gldt,goal,rate then
   do the following: (Could just error out if exactly 2 out of 3 not given.)
   Default to a flat road if only end time is given. If only goal or rate is 
   given, default to an end time of t0 plus a year. If nothing is given, default
   to a flat road that extends for a year. *)
genRdMtx[] := (
  If[gldt=!=Null && goal=!=Null && rate=!=Null, rate = Null];
  {gldt, goal, rate} = 
    Switch[{gldt, goal, rate}, {Null, Null, Null}, {p1y@t0, Null, 0   },
                               {Null, Null, rate}, {p1y@t0, Null, rate},
                               {Null, goal, Null}, {p1y@t0, goal, Null},
                               {gldt, Null, Null}, {gldt,   Null, 0   },
                               {_, _, _},          {gldt,   goal, rate}];
  {#1,#2,#3*siru}& @@@
                  Rest@FoldList[grm0, {t0,v0,0}, cleanRM[gldt,goal,rate, road]])

(* Return the value of the segment of the YBR at time x, given the start (t0,v0)
   and the rate. Equivalently, we could give the start and end points, (t0,v0)
   and (t1,v1), instead of the rate. *) 
rdSeg[r_, t0_,v0_][x_] := If[exprd, N[v0*Exp[r(x-t0)]], v0+r(x-t0)]

(* Take a road matrix and a variable x and construct a Piecewise function, eg,
   Piecewise[{{rdSeg[t1,v1,r1,t0,v0][x], x < t1},
              {rdSeg[t2,v2,r2,t1,v1][x], t1 <= x < t2}, ...,
              {v, t <= x}}] *)
cpw0[{{t1_,v1_,r1_},{t2_,v2_,r2_}}] := {rdSeg[r2, t1,v1][x], t1 <= x < t2}
cpw[_,v0_, {}, x_] := v0
cpw[t0_,v0_, m_, x_]:= Piecewise[Join[{{rdSeg[m[[1,3]], t0,v0][x], x<m[[1,1]]}},
                                      cpw0 /@ Partition[m,2,1], 
                                      {{m[[-1,2]], True}}]]

(* Return a pure function mapping timestamp to the y-value of the YBR.  
   The start of the road, {t0,v0}, as well as goal,gldt,rate are global. *)
genRoadFunc[] := Function[x, Evaluate[cpw[t0,v0, {#1,#2,#3/siru}& @@@ road, x]]]

(******************************************************************************)
(********* RATES, LANES, AND SAFETY BUFFERS OF THE YELLOW BRICK ROAD **********)

(* Appropriate color for a datapoint. *)
dotcolor[{t_,v_}] := With[{l = lanage[{t,v}]}, Which[
  t===Null || v===Null,     BLCK, (* can happen if error prevented graph gen? *)
  yaw==0 && Abs[l] > 1,     GRNDOT,
  yaw==0 && (l==0 || l==1), BLUDOT,
  yaw==0 && l == -1,        ORNDOT,
  l*yaw >=  2,              GRNDOT,
  l*yaw ==  1,              BLUDOT,
  l*yaw == -1,              ORNDOT,
  l*yaw <= -2 && t<tz,      YELDOT,
  l*yaw <= -2,              REDDOT]]

(* SCHDEL:
  y<0 && a<=0    || y>0 && b>=0    || y==0 && (b>0||a<0),                GRNDOT,
  y<0&&a>0&&d<=0 || y>0&&d>=0&&b<0 || y==0&&If[u,d>=0&&b<=0,a>=0&&d<=0], BLUDOT,
  y<0&&d>0&&b<=0 || y>0&&a>=0&&d<0 || y==0&&If[u,a>=0&&d<=0,d>=0&&b<=0], ORNDOT,
  (y<0 && b>0    || y>0 && a<0) && t<tz,                                 YELDOT,
  y<0  && b>0    || y>0 && a<0,                                          REDDOT,
  True, (* should never happen but make it bright green just in case *)  Green]]
*)

(* Whether we're officially off the road (off both yesterday and today). 
   Note that this depends on the global lnw being set. *)
isLoser[{t_,v_}] := dotcolor[{t,v}] === REDDOT && 
                    MemberQ[{REDDOT, YELDOT}, dotcolor[{t-SID, dtf[t-SID]}]]

(* The safety buffer, safebuf, is the number of days you can stay flat and still
   be on the road. Think of it as a countdown to the wrong lane.
   If you're on the wrong side of the road then this is a negative number -- it 
   tells you how many days ago you were last on the road. Ie:
     safebuf +2 or more: good side of the road
     safebuf +1:         right lane
     safebuf  0:         wrong lane
     safebuf -1:         beemergency
     safebuf -2 or less: irredeemably off the road
   Note that safety buffer doesn't really make sense for WEEN and RASH graphs 
   where staying flat puts you further and further onto the right side of the 
   road. The safebuf will always be "infinity" for such graphs.
   Implementation notes:
   For noisy graphs there are two cases to consider:
   1. If the graph is noisy and you're in the right lane, conservatively assume
      the width is the minimum possible: lnf[t]. Not only can the noisy width 
      shrink as you walk forward but, being noisy, your datapoint could jump off
      the road the day after you cross into the wrong lane. (The Really Right 
      thing might be to recompute noisyWidth prospectively based on flatlining 
      till going into the wrong lane, at which point the road width would be 
      fixed, and then seeing how many additional days before going off the 
      road.)
   2. If the graph is noisy and you're in the *wrong* lane, then the width is 
      fixed so it's just like the straightforward case of non-noisy graphs 
      except you have to max lnf[t] with noisyWidth. *)
getSafebuf[{t_,v_}] := Module[{fnw, elnf, x},
  fnw = If[gdelt[{t,v}] >= 0, 0, nw]; (* future noisy width *)
  elnf = Max[lnf[#], fnw]&;  (* effective lane width function *)

  (* if we're on the road or on the yaw side of it, walk forward till we're off
     the road: one less than the number of steps (days) is the safebuf.
     otherwise, walk backward till we're back on it. *)
  x = 0;  (* the number of steps *)
  If[aok[{t,v}, elnf[t]],
    While[aok[{t+x*SID,v}, elnf[t+x*SID]] &&t+x*SID<=Max[gldt,t](*x<=61*), x++];
    x--;  (* the number of steps *before* we stepped off *)
  ,
    While[!aok[{t+x*SID,v}, elnf[t+x*SID]] && x>=-60, x--];
    (* x is now the number of negative steps to get back on *)
  ];
  (* At least one safe day if noisy and in right lane, due to can't-lose-tmw *)
  If[noisy && gdelt[{t,v}]>=0, x = Max[1, x]];
  x]
  (* instead of cutting off the walk at 61 steps we could count all the way back
     to t0 or all the way forward to gldt. of course we might be very close to 
     gldt so the safety buffer is really infinite if it hits gldt. we could use
     367 ("more than a year") as a proxy for infinity. *)

(* This is a hack. The normal safety buffer computation is conservative in that
   it assumes the future noisy width will be zero. This underestimates your true
   safety buffer days. That's ok for the number you report in the stats bar but
   for determining when to stop plotting, we need to be conservative in the 
   opposite way. So for now I'm duplicating getSafebuf but assuming the future
   noisy width stays the same as currently. I think this means we need to do the
   "Really Right" thing as noted above. *)
getSafebufLib[{t_,v_}] := Module[{fnw, elnf, x},
  fnw = nw;
  elnf = Max[lnf[#], fnw]&;
  x = 0;
  If[aok[{t,v}, elnf[t]],
    While[aok[{t+x*SID,v}, elnf[t+x*SID]] && t+x*SID <= Max[gldt,t], x++];
    x--;
  , 
    While[!aok[{t+x*SID,v}, elnf[t+x*SID]] && x>=-60, x--];
  ];
  If[noisy && gdelt[{t,v}]>=0, x = Max[1, x]];
  x]

(* Return a pure function mapping timestamp to the rate of the YBR at that time.
   The returned rate is in units per second (absolute not fractional rate).
   Ie, this is the derivative of the road function wrt time. 
   Note: if you ask for the rate at a kink in the road, it gives the *new* rate.
   NB: The road matrix and road function must exist when we call this. 
   Implementation note: Stepify constructs a step function where the supplied
     datapoints give the *start* of a new step, but the road matrix gives the 
     points where each rate *ends*, hence the Transpose/Prepend munging before
     stepifying. For example, {t,r} road segments 
       {{2,20},{5,40},{6,30}} should get transformed to 
       {{2,40},{5,30},{6,0}} with a stepify default of 20 to cover the first the
     first segment that ends at time 2. *)
genRateFunc[] := Module[{road0, rtf0},
  road0 = DeleteDuplicates[road, First[#1]==First[#2]&];
  rtf0 = stepify[Transpose[{road0[[All,1]], 
                            Rest@Append[road0[[All,3]], 0]}], road0[[1,3]]];
  1/siru * If[exprd, rdf[#], 1] * rtf0[#] &]

(* Helper function for the adjusted daily deltas in noisyWidth. *)
ad0[{{t1_,v1_}, {t2_,v2_}}] := Abs[v2 - v1 - rdf[t2] + rdf[t1]] / (t2-t1) * SID

(* For noisy graphs, compute the lane width based on the data and YBR.
   Specifically, get the list of daily deltas between all the points, but adjust
   each delta by the road rate (eg, if the delta is equal to the delta of the 
   road itself, that's an adjusted delta of 0).
   Set the lane width to be the 90% quantile of those adjusted deltas.
   But then increase the width if necessary for the guarantee that you can't 
   lose tomorrow if you're in the right lane today.
   Specifically, when you first cross from right lane to wrong lane (if it 
   happened from one day to the next), the road widens if necessary to 
   accommodate that jump and then the road width stays fixed until you get back 
   in the right lane.
   So for this function that means if the current point is in the wrong lane, 
   look backwards to find the most recent one-day jump from right to wrong. That
   wrong point's deviation from the centerline is what to max the default road 
   width with. *)
noisyWidth[{{t_,v_}}] := 0
noisyWidth[data_] := Module[{n, ad, i, nw},
  n = Length[data];
  ad = ad0 /@ Partition[data, 2, 1];
  nw = If[Length[ad]==1, First@ad, Quantile[ad, .90]];
  If[gdelt[data[[-1]]] < 0,
    For[i = -1, i >= -n && gdelt[data[[i]]] < 0, i--];
    i++;
    If[i > -n && data[[i,1]] - data[[i-1,1]] <= SID,
      nw = Max[nw, Abs[data[[i,2]] - rdf[data[[i,1]]]]]]]; (* autowiden *)
  Chop@nw]

(* Return a pure function mapping timestamp to the width of the YBR at that
   time. This does not incorporate noisyWidth -- this is the minimum width given
   the rate of the road. If noisy this has to be maxed with noisyWidth.
   Mostly the lane width at a given time is the daily absolute rate of the road
   at that time, but there are 3 exceptions:
   * Flat Spot exception: the lane width for a flat spot is the rate of the 
     previous or next non-flat segment, whichever's bigger. 
   * Exp exception: The lane function was not *quite* right for exponential 
     roads. It gave lane width based on the instantaneous daily rate but that 
     means that the rate (for decreasing graphs) is slightly less than the day 
     before. So if you were right on the centerline yesterday then the lane 
     width today is slightly less than the amount that the centerline dropped 
     since yesterday. So you'll be ever so slightly off your road if you stay 
     flat, violating the Can't Lose Tomorrow guarantee. So we max with the 
     difference in the road function from the previous day. 
   Implementation note:
   If it weren't for the exceptions this would just return SID*Abs@rtf[#]& *)
genLaneFunc[] := Module[{road0, t, r, rb, rf, rtf0},
  road0 = DeleteDuplicates[road, First[#1]==First[#2]&];
  (* t: times that new rates start; nb: in the road matrix they're end times
     r: the corresponding new rates, dailyified *)
  t = road0[[All,1]];
  r = Append[SID/siru*Abs[#]& /@ road0[[All,3]], 0];
  (* pretend flat spots have the previous or next non-flat rate *)
  rb = FoldList[If[Chop[#2]==0, #1, #2]&, First@r, Rest@r];
  rf = Reverse@FoldList[If[Chop[#2]==0, #1, #2]&, Last@r, Reverse@Most@r];
  r = MapThread[argMax[Abs, {##}]&, {rb, rf}];
  rtf0 = stepify[Transpose[{t,Rest@r}], First@r];
  Max[Abs[rdf[#]-rdf[#-SID]], If[exprd, rdf[#], 1] * rtf0[#]]&
]

(* In case we want to compute the noisy width at each point in the past:
   http://stackoverflow.com/questions/6880022/update-the-quantile *)

(******************************************************************************)
(************************* PROCESS INPUT PARAMETERS ***************************)

(* Whether a parameter/value pair is legit. *)
(* This is likely subsumed by vetParams. *)
(* More compact but more obtuse version: legit[p_,v_] := (Head[p]===String &&
  (v===Null || v===True || v===False || Head[v]===String || Head[v]===List || 
   Head[v]===Integer || Head[v]===Real || Head[v]===Rational)) *)
legit[_,_]                = False;
legit[_String, Null]      = True;
legit[_String, True]      = True;
legit[_String, False]     = True;
legit[_String, _String]   = True;
legit[_String, _List]     = True;
legit[_String, _Integer]  = True;
legit[_String, _Real]     = True;
legit[_String, _Rational] = True;

(* Sanity check a row of the road matrix *)
validrow[_] = False;
validrow[{t_,v_,r_}] := Count[{t,v,r}, Null] == 1 && (
  (t===Null || NumberQ[t]) &&
  (v===Null || NumberQ[v]) &&
  (r===Null || NumberQ[r]))

(* True Or False; Numeric Or Null; String or Null *)
torf[x_] := (x===True || x===False)
norn[x_] := (x===Null || NumericQ[x])
sorn[x_] := (x===Null || StringQ[x])

(* Sanity check the input parameters and set conditional defaults for them. *)
vetParams[] := (
  each[i_, {gldt, reset, asof},
    i = dayfloor@tm@i]; (* ensure dates are all dayfloored timestamps *)
  If[!(gldt===Null || NumericQ[gldt] && tm@{2008,02,11} < gldt), 
                 Return@cat["'gldt' isn't a time after 2008-02-11: ",gldt]];
  If[!norn@goal, Return@cat["'goal' isn't numeric or null: ",goal]];
  If[!norn@rate, Return@cat["'rate' isn't numeric or null: ",rate]];
  (* If[gldt===Null && goal===Null && rate===Null, Return@cat[
    "Goal date, goal, and rate can't all be null"]]; *)
  If[!ListQ[road], Return@cat["Road matrix ('road') isn't a list: ",road]];
  If[!(road==={} || Length@Dimensions[road]===2), Return@cat[
    "Road matrix ('road') isn't a 2D matrix: ",road]];
  If[!(road==={} || Dimensions[road][[2]]), Return@cat[
    "Road matrix ('road') isn't an n-by-3 matrix: ",road]];
  If[Length@road != Length@DeleteDuplicates@road, Return@cat[
    "Road matrix ('road') has duplicate rows: ",road]];
  Module[{err, flag = False},  (* sanity check the road matrix... *)
    each[i_, road,
      If[!flag && !validrow[i],
        err = cat["Invalid road matrix row: ",i];
        flag = True]];
    If[flag, Return@err]];
  If[!MemberQ[keys[secs], runits], Return@cat[
    "Bad rate units ('runits'): ",runits]];
  If[!torf@exprd,  Return@cat["'exprd' isn't boolean: ",          exprd]];
  If[!norn@reset,  Return@cat["'reset' isn't numeric or null: ",  reset]];
  If[!norn@asof,   Return@cat["'asof' isn't numeric or null: ",   asof]];
  If[!torf@kyoom,  Return@cat["'kyoom' isn't boolean: ",          kyoom]];
  If[!torf@odom,   Return@cat["'odom' isn't boolean: ",           odom]];
  If[!norn@abslnw, Return@cat["'abslnw' isn't numeric or null: ", abslnw]];
  If[!torf@edgy,   Return@cat["'edgy' isn't boolean: ",           edgy]];
  If[!torf@noisy,  Return@cat["'noisy' isn't boolean: ",          noisy]];
  If[!(MemberQ[keys[aggregator], aggday]), Return@cat[
    "'aggday' isn't in ",keys@aggregator,": ", aggday]];
  If[!torf@plotall, Return@cat["'plotall' isn't boolean: ",plotall]];
  If[!MemberQ[{0,-1,1}, yaw], Return@cat["'yaw' isn't in {0,-1,1}: ", yaw]];
  If[!MemberQ[{-1,1}, dir],   Return@cat["'dir' isn't in {-1,1}: ",   dir]];
  If[kyoom && dir<0, Return@cat[   (* questionable whether this is necessary *)
    "Can't have a kyoom graph with downward-sloping YBR (dir<0)"]];
  If[!torf@steppy,   Return@cat["'steppy' isn't boolean: ",   steppy]];
  If[!torf@rosy,     Return@cat["'rosy' isn't boolean: ",     rosy]];
  If[!torf@movingav, Return@cat["'movingav' isn't boolean: ", movingav]];
  If[!torf@aura,     Return@cat["'aura' isn't boolean: ",     aura]];
  If[!torf@stathead, Return@cat["'stathead' isn't boolean: ", stathead]];
  If[!StringQ@yaxis, Return@cat["'yaxis' isn't a string: ",   yaxis]];
  If[!torf@zfill,    Return@cat["'zfill' isn't boolean: ",    zfill]];
  If[!torf@tagtime,  Return@cat["'tagtime' isn't boolean: ",  tagtime]];
  If[!NumericQ[nytz] || nytz < -24 || nytz > 24, Return@cat[
    "'nytz' isn't a number in [-24,24]: ",nytz]];
  If[!NumericQ[imgsz],   Return@cat["'imgsz' isn't numeric: ",       imgsz]];
  If[!sorn@waterbuf, Return@cat["'waterbuf' isn't string or null: ", waterbuf]];
  If[!StringQ[waterbux], Return@cat["'waterbux' isn't a string: ",   waterbux]];
  If[!torf@sendmail,     Return@cat["'sendmail' isn't boolean: ",    sendmail]];
  If[!StringQ[email],    Return@cat["'email' isn't a string: ",      email]];
  If[!StringQ[usr],      Return@cat["'usr' isn't a string: ",        usr]];
  If[!StringQ[graph],    Return@cat["'graph' isn't a string: ",      graph]];
  ""
)

(* Vet the input parameters and set global variables derived from them (the 
   settings themselves are also global variables). Also apply various 
   transfomations to the data, stored in the global variable 'data'. 
   Returns a string indicating errors, or "" if none. *)
init[] := Module[{err, parenerr, flp},
  tp = Null;   (* Initialize               Recall that the          *)
  vp = Null;   (*  global variables         input/output            *)
  rdf = (0&);  (*   defined above.           parameters defined in  *)
  rtf = (0&);  (*    Note that 'data'         pin/pout are also     *)
  lnf = (0&);  (*     was initialized          global variables.    *)
  nw = 0;      (*      in genStats.                                 *)
  dtf = (0&);  

  color = "black";  (* in case we error out of here early before color is set *)

  If[(err = vetParams[])=!="", Return@err];

  siru = secs[runits];
  If[data==={}, Return["No datapoints"]];
  If[(err = saneData[data])=!="", Return@err];
  data = Take[#,2]& /@ data;      (* throw away the comments *)
  data = SortBy[data, {First}];   (* sort by timestamp; NB: stable sort! *)
  data = floorify[data];          (* make all timestamps be at midnight *)
  data = aggregate[data];         (* one datapoint per day, unless aggday=all *)

  If[asof===Null, asof = dayfloor[proctm+nytz*3600];
  , data = Select[data, First@# <= asof&];
    If[data==={}, Return["No datapoints as of 'asof' date"]]];

  {tzd, vzd} = Last@data;        (* remember last actually entered datapoint, *)
  numpts = applyReset[reset];    (*  before any artificial ones added.        *)
  If[odom,  data = odomify[data]];
  If[kyoom, data = kyoomify[data]]; (* maybe this should happen before agging *)

  (* hack for kyoom graphs that don't start at zero *)
  Which[
        usr=="meta" && graph=="paid",    data = ({#1, #2+10}&  @@@ data),
        usr=="meta" && graph=="revenue", data = ({#1, #2+10}&  @@@ data),
        usr=="meta" && graph=="pledged", data = ({#1, #2+95}&  @@@ data)];
  
  setVals[];
  data = aggregate[data, "last"];  (* now definitely 1 datapt per day *)

  t0 = data[[1,1]];  (* start of YBR, {t0,v0}, is usually the first datapoint *)
  v0 = If[kyoom, 0, First@vals[t0]];

  (* hack for graphs, kyoom or not, that don't start at zero *)
  Which[
        usr=="meta" && graph=="paid",    v0 = 10,
        usr=="meta" && graph=="revenue", v0 = 10,
        usr=="meta" && graph=="users",   v0 = 451,
        usr=="meta" && graph=="pledged", v0 = 95];

  If[exprd && Chop[v0]==0, exprd = False; Return@cat[
    "Exponential roads can't start with value zero"]];
  If[exprd && some[#=!=Null && #<0&, road[[All,2]]], exprd = False; Return@cat[
    "Exponential roads must always be positive"]];

  dtf = stepify[data]; (* maps timestamp to most recent datapoint value *)

  {t0d, v0d} = {t0,v0};  (* remember actual initial datapoint *)
  (* Special leniency for noisy graphs: YBR starts at the min or max (depending 
     on yaw) of your first 3 datapoints: *)
  If[noisy && yaw!=0, v0 = yaw*Min[yaw*v0, 
                                   yaw*Take[data,Min[3,Length@data]][[All,2]]]];
  If[edgy && abslnw=!=Null, v0 -= yaw*abslnw];
  If[edgy && abslnw===Null, t0 -= SID];      (* see notes at top of this file *)
  road = genRdMtx[];
  {gldt, goal, rate} = Last@road;
  parenerr =
   "(Your goal date, goal "<>If[kyoom,"total","value"]<>
   ", and rate are inconsistent!\\n"<>
   "Is your rate positive when you meant negative?\\n"<>
   "Or is your goal "<>If[kyoom,"total","value"]<>
   " such that the implied goal date is in the past?)";
  If[reset=!=Null && reset >= gldt, Return@cat[
    "Reset date is after the goal date\\n",parenerr]];
  If[!OrderedQ[road[[All,1]]], Return@cat[
    "Road dial error\\n",parenerr]];
  rdf = genRoadFunc[];
  If[edgy && abslnw===Null, t0 += SID; v0 = rdf[t0]];

  rtf = genRateFunc[];
  nw = If[noisy && abslnw===Null, noisyWidth[data], 0];
  lnf = If[abslnw===Null, genLaneFunc[], (abslnw&)];
  {tz,vz} = Last@data; (* time & value of last datapoint *)
  safebuf = getSafebufLib[{tz,vz}];
  flp = (* flatline point to insert *)
    Clip[tz+SID(Max[safebuf,-1]+2), {tz, Max[Min[asof,gldt],tz]}]; 
  If[vals[flp]==={}, data = insertZero[data, flp]];
  {tz,vz} = Last@data; (* new last datapoint after maybe adding one *)
  safebuf = getSafebuf[{tz,vz}];
(* SCHDEL:
  If[waterbuf===Null, waterbuf = If[dir*yaw<0, "", cat[safebuf]]];
  Which[safebuf>999,       waterbuf = If[dir*yaw<0, "", FromCharacterCode@8734],
        safebuf==0 && gldt<=asof, waterbuf = FromCharacterCode@9786
  ];
*)
  If[zfill, data = fillZeros[data]];
  delta = Chop[vz - rdf[tz]];
  rah = rdf[tz+HORIZ/2];
  {tg,vg} = {tz+HORIZ, rdf[tz+HORIZ]};  (* target in a week or so *)
  zrate = rtf[tz] * siru / If[exprd, rdf[tz], 1];
  avgrt = tvr[gldt,goal,Null, t0,v0]*siru; (* overall rate for whole YBR *)

  cntdn = Ceiling[(gldt-tz)/SID];  (* countdown till goal date, in days *)

  lnw = If[noisy, Max[nw, lnf[tz]], lnf[tz]];
  lane = lanage[{tz,vz}];
  color = colorname@dotcolor@{tz,vz};
  loser = isLoser[{tz,vz}];
  losedate = tz + (safebuf+1)*SID;
  (* Other handy chars: 9888 = triangle-bang warning symbol, 
                        9760 = skull&crossbones *)
  waterbuf = Which[
    waterbuf=!=Null,       waterbuf,
    asof>=gldt && !loser,  FromCharacterCode@9786, (* smiley face *)
    dir*yaw<0,             "",
    safebuf>999,           FromCharacterCode@8734, (* infinity symbol *)
    True,                  safebuf];
  ""]

(******************************************************************************)
(***************************** GENERATE THE GRAPH *****************************)

(* Converts a color to a string like imagemagick wants. *)
colorstring[RGB[r_,g_,b_]] := cat["rgb(",Round[r*255],",",
                                         Round[g*255],",",
                                         Round[b*255],")"]
colorstring[GrayLevel[x_]] := colorstring@RGB[x,x,x]

colorhex[c_RGB] := cat@@(IntegerString[Round[#*255],16,2]&/@c)
colorhex[GrayLevel[x_]] := colorhex@RGB[x,x,x]

colorname[_]      = "";                   colorblurb[_]      = "";
colorname[GRNDOT] = "green";              colorblurb[GRNDOT] = "Green. ";
colorname[BLUDOT] = "blue";               colorblurb[BLUDOT] = "Blue. ";
colorname[ORNDOT] = "orange";             colorblurb[ORNDOT] = "Orange. ";
colorname[REDDOT] = "red";                colorblurb[REDDOT] = "Red! ";
colorname[YELDOT] = "yellow";             colorblurb[YELDOT] = "Yellow? ";
colorname[BLCK]   = "black";              colorblurb[BLCK]   = "Black? ";

(* To test how the dots will look in a Mma notebook:
     hotpink = RGBColor[1,.2,.5];
     Graphics[{Black, Disk[{0,0}, 1.5], hotpink, Disk[]}] *)

(* Scale factor to multiply by for PointSize and Thickness and disk radius for
   dots.  If the timespan of the graph (tg - t0) is at least 73 days then this 
   just gives a constant scale factor of 1/400.  If fewer days then this will be
   up to twice that.  This gives the radius of the colored inner disk for 
   datapoints (as a fraction of the width of the whole graph) and everything 
   else is some amount bigger than that.  
   (Currently the black disk that surrounds the colored one is 3/2 times as big
   and the rose or purple dots are (3/2)^2 times as big.)
   Note that PointSize wants a diameter, not a radius so double this when used 
   for PointSize. *)
scl[] := cvx[tg, {t0,t0+73SID}, {2,1}]/400

(* Start at the first data point plus sgn*delta and walk forward making
   the next point be equal to the previous point, clipped by the next point
   plus or minus delta.  Used for the rose-colored dots. *)
inertia0[x_, d_, sgn_] := FoldList[Clip[#1,{#2-d,#2+d}]&, x[[1]]+sgn*d, Rest@x]
inertia[data_, del_,sgn_]:= Transpose@{#1,inertia0[#2,del,sgn]}&@@Transpose@data
(* Same thing but start at the last data point and walk backwards. *)
inertiaRev[data_,del_, sgn_] := Reverse@inertia[Reverse@data,del,sgn]

(* Shortcut for DateListPlot *)
dlp[{}, ___] := Graphics[]
(* this case works around a bug in DateListPlot (can't plot just one point) *)
dlp[{{x_,y_}}, style_, stuff___] := dlp[{{x,y},{x-.01,y}}, style, stuff]
dlp[data_, style_, stuff___] := DateListPlot[data, 
           PlotStyle->style, stuff, Frame->True, FrameTicks->All]

(* Generate the paved yellow brick road, without the centerline. *)
(* Note: functions starting with "gr" generate graphics. *)
grRoad[] := Module[{critpts, x,y},
  (* first get the YBR value at all kinks in the road, plus the endpoints *)
  critpts = rdf/@Union[{t0,tg},Select[road[[All,1]], t0<=#<=tg&]];
  If[lnw==0, Return[Graphics[]]];
  RegionPlot[-lnw < y-rdf[x] < lnw,  (* should be fbot[x] <= y <= ftop[x] *)
    {x, t0, tg}, {y, Min[critpts]-lnw, Max[critpts]+lnw},
    PlotRange->{ymin,ymax}, 
    PlotStyle->DYEL, BoundaryStyle->None,
    Mesh->10, MeshStyle->None, MeshShading->{{DYEL,LYEL},{LYEL,DYEL}},
    PlotPoints->PLON]]

(* Generate the centerline for the yellow brick road. *)
grCenterline[] := Plot[rdf[x], {x,t0,tg}, Evaluate@PRAL, 
  PlotStyle->Directive[Dashing@{.04,.08},Orange,THCK[scl[]]]]

(* Generate a razor thin version of the YBR that should show up even if the YBR
   itself has zero thickness.  (The dashed orange centerline goes on TOP of the
   aura but this goes underneath it.) *)
grRazor[] := Plot[rdf[x], {x,t0,tg}, 
  Evaluate@PRAL,PlotStyle->Directive[DYEL,THCK[2.4scl[]]]] (* 1.2->2.4 *)

(* Watermark: safebuf on good side of the YBR and pledge on bad side. *)
grWatermark[] := Module[{jrf,glev, g,b, rbl,rbr,rtl,rtr},
  jrf = "jollyroger_sqr.png"; (* image of skull and crossbones *)
  glev = .9625; (* graylevel for the watermarks *)
  g = Which[
    loser && FileExistsQ[jrf], Import[jrf],
    True,                      Style[waterbuf, "Title", GrayLevel[glev]]];
  b = Style[waterbux, "Title", GrayLevel[glev]];
  rbl = {{t0,                 ymin}, {(t0+tg)/2, (ymin+ymax)/2}}; (*botleft*)
  rbr = {{(t0+tg)/2,          ymin}, {tg,        (ymin+ymax)/2}}; (*botright*)
  rtl = {{t0,        (ymin+ymax)/2}, {(t0+tg)/2,          ymax}}; (*topleft*)
  rtr = {{(t0+tg)/2, (ymin+ymax)/2}, {tg,                 ymax}}; (*topright*)

  Which[
    dir>0 && yaw<0, {rendrect[g, rbr], rendrect[b, rtl]},  (*WEEN*)
    dir<0 && yaw>0, {rendrect[g, rtr], rendrect[b, rbl]},  (*RASH*)
    dir<0 && yaw<0, {rendrect[g, rbl], rendrect[b, rtr]},  (*PHAT*)
    True,           {rendrect[g, rtl], rendrect[b, rbr]}]] (*MOAR*)

(* Draw the dotted pink vertical Akrasia Horizon line. *)
grAhorizon[] := Graphics[{Dashed, ROSE,
  Line[{{dayfloor[asof+HORIZ/2], ymin},
        {dayfloor[asof+HORIZ/2], ymax}}],
  Text[Style["Akrasia Horizon",ROSE],
       {dayfloor[asof+HORIZ/2], (ymin+ymax)/2}, {0,1}, {0,1}]
}]

(* Returns a pure function that fits the data smoothly; used by grAura. *)
smooth[data_] := With[{smoo = 10^5*SID},  (* the bigger the smoother *)
  Function[x, Evaluate[Fit[{smoo,0}+#&/@data, {1,x,x^2,x^3}, x]/.x->x+smoo]]]

(* Double Exponential Moving Average: http://stackoverflow.com/q/5533544 *)

(* Generate guide lines parallel to the centerln on the good side of the YBR. *)
grGuidelines[] := Module[{x, n, m},
  n = If[lnw==0, 0, Floor[Abs[vg-v0]/lnw]]; (* number of guiding lines *)
  m = Clip[n, {1,32}];
  Table[Plot[rdf[x]+i*yaw*lnw, {x,t0,tg},
             PlotRange->{ymin,ymax},
             PlotStyle->Directive[If[Mod[i,2]==0,DYEL,LYEL], THCK[.0022]]],
        {i, 2, n, Max[1,Round[n/m/7]*7]}]]

(* Used with grAura[], this adds dummy datapoints on every day that doesn't have
   a datapoint, interpolating linearly. *)
gapFill[data_] := Module[{data0 = data, start,end, given,prev,next, dummies, x},
  start = data0[[1,1]];
  end = data0[[-1,1]];
  each[{t_,v_}, data0,  given[t] = 1];
  dummies = {#, Null}& /@ Select[Range[start, end, SID], given[#]=!=1&];
  data0 = SortBy[Join[data0, dummies], {First}];
  (* walk forward (backward) remembering the prev (next) value for each dummy *)
  each[{t_, v_}, data0,          If[v =!= Null, x = {t, v}]; prev[t] = x];
  each[{t_, v_}, Reverse[data0], If[v =!= Null, x = {t, v}]; next[t] = x];
  sandwich[prev@First[#], #, next@First[#]]& /@ data0]

(* need to DRY up: grRoad, grAura, grOverlap, grOverlapGL, and grGuidelines *)
(* maybe one function, generateGraphicsComponents, should return a list of all
   of them and then genGraph can get the list and arrange them how it wants *)

(* Aura around the points. *)
grAura[data_]:= Module[{g, shiftdn,shiftup},
  If[Length[data]==1 || data[[-1,1]]-data[[1,1]]<=0, Return[Graphics[]]];
  g = smooth@gapFill[data];
  shiftdn = Min[-lnw/2, Min[#[[2]]-g[#[[1]]]& /@ data]];
  shiftup = Max[lnw/2,  Max[#[[2]]-g[#[[1]]]& /@ data]];
  RegionPlot[shiftdn < y-g[x] < shiftup,
    {x, t0, asof+HORIZ/2}, {y, ymin, ymax},
    PlotStyle->BLUE, PlotPoints->PLON, Evaluate@PRAL, BoundaryStyle->None]]

(* Opacity/transparency doesn't work so draw the intersection explicitly. 
   This is an amalgamation of grRoad[] and grAura[]. *)
grOverlap[data_] := Module[{g, x, y, shiftdn, shiftup},
  If[Length[data]==1 || data[[-1,1]]-data[[1,1]]<=0, Return[Graphics[]]];
  g = smooth@gapFill[data]; 
  shiftdn = Min[-lnw/2, Min[#[[2]]-g[#[[1]]]& /@ data]];
  shiftup = Max[lnw/2,  Max[#[[2]]-g[#[[1]]]& /@ data]];
  RegionPlot[shiftdn < y-g[x] < shiftup && -lnw < y-rdf[x] < lnw,
    {x, t0, asof+HORIZ/2}, {y, ymin, ymax}, 
    PlotStyle->GRUE, PlotPoints->PLON, BoundaryStyle->None]]

(* Same as above but for the aura's overlap with the guide lines. *)
grOverlapGL[data_] := Module[{g, shiftdn, shiftup, n, m},
  If[Length[data]==1 || data[[-1,1]]-data[[1,1]]<=0, Return[Graphics[]]];
  n = If[lnw==0, 0, Floor[Abs[vg-v0]/lnw]];
  m = Clip[n, {1,32}];
  g = smooth@gapFill[data];
  shiftdn = Min[-lnw/2, Min[#[[2]]-g[#[[1]]]& /@ data]];
  shiftup = Max[lnw/2,  Max[#[[2]]-g[#[[1]]]& /@ data]];
  Plot[Table[rdf[x]+i*yaw*lnw, {i, 2, n, Max[1,Round[n/m/7]*7]}], 
       {x, t0, asof+HORIZ/2}, 
       RegionFunction->Function[{x,y}, shiftdn<y-g[x]<shiftup],
       PlotRange->{ymin,ymax}, PlotPoints->Round[1.5*PLON],
       PlotStyle->Directive[GRUE, THCK[.0022]]]]

(* Draw a bull's eye. Kloch thinks we should have a nicer one. *)
grBullseye[{x_,y_}] := Graphics[{
  Red,   Disk[{x,y}, Scaled[{1, 2.5/ASP}*scl[]*5/2]],
  White, Disk[{x,y}, Scaled[{1, 2.5/ASP}*scl[]*4/2]],
  Red,   Disk[{x,y}, Scaled[{1, 2.5/ASP}*scl[]*3/2]],
  White, Disk[{x,y}, Scaled[{1, 2.5/ASP}*scl[]*2/2]],
  Red,   Disk[{x,y}, Scaled[{1, 2.5/ASP}*scl[]*1/2]]}]

(* For every datapoint {x,y}, except the first one, with previous datapoint
   {x0,y0}, insert a datapoint {x,y0}.  This makes the plot of the points be
   steppy, ie, always have zero or infinite slope. *)
asp0[{{x1_,y1_}, {x2_,y2_}}] := Sequence[{x1,y1}, {x2,y1}]
addStepPoints[l_]:= Most[asp0 /@ Partition[Join[
  If[kyoom, {{t0,0}}, {}], l, {Last@l}], 2,1]]

grDots[data_] := Graphics@Flatten[
  {If[#[[1]]>tzd, dotcolor[#], Black], Disk[#, Scaled[{1,1/ASP}*scl[]*1.5]],
   dotcolor[#],                      Disk[#, Scaled[{1,1/ASP}*scl[]]]}& /@ data]

(* This is a handy shortcut for combining graphics with Show. *)
(* SCHDEL: 
SetAttributes[pIf, HoldAll];
pIf[cond_, graphix__] := If[cond, {graphix}, Graphics[], 
  prn["WARNING: ", cond, " doesn't evaluate to either True or False"];
  Graphics[]]
*)

(* Given amount to go to bottom edge, centerline, top edge. Return a string
   indicating that. *)
(* SCHDEL:  baremin/hardcap should subsume this
prTogo[{a_, b_, c_}] := Module[{str, pa,pb,pc},
  str = cat[If[a<0, "-", shn@a], ", ", If[b<0, "-", shn@b], ", ", shn@c]; 
  If[tagtime, 
    {pa, pb, pc} = {a,b,c}/PING;
    str = str <> cat["  (",
      If[pa<0,"-",shn@pa], ", ", If[pb<0,"-",shn@pb], ", ", shn@pc, " pings)"]];
  str]
*)

(* Helper function for genStats that's called after the global out-params are
   set for the graph. It considers all the possible graph types and constructs 
   the appropriate human-readable summary lines. *)
sumSet[] := Module[{minr,maxr, safeblurb, ybrStr, pingStr},
  minr = Min[road[[All,3]]];
  maxr = Max[road[[All,3]]];
  If[Abs@minr > Abs@maxr, {minr,maxr} = {maxr,minr}];
  ratesum = cat[
    If[minr==maxr, shr@minr, cat["between ",shr@minr," and ",shr@maxr]],
    " per ",unam[runits],
    If[minr!=maxr, cat[" (",   (* SCHDEL: "global: ",shr@rate, *)
                       "current: ",shr@zrate,
                       ", average: ",shr@avgrt,")"], ""]];

  (* What we actually want is timesum and togosum (aka, progtsum & progvsum)
     which will be displayed with labels TO GO and TIME LEFT in the stats
     box and will have both the absolute amounts remaining as well as the 
     percents done as calculated here. *)
  progsum = Module[{pt,pv},
    pt = shn[cvx[dayfloor@tz, dayfloor/@{t0,gldt}, {0,100}, False], 1,1];
    pv = cvx[vz, {v0,goal}, {0,100}, False];
    pv = shn[If[v0<goal, pv, 100 - pv], 1,1]; (* meant shn[n,1,2] here? *)
    If[pt==pv, cat[pt,"% done"],
      cat[pt,"% done by time -- ",pv,"% by value"]]];

  ybrStr = Module[{x},
    If[cntdn < 7,
      x = Sign[rate]*(goal-vz);
      cat["To go to goal: ", shn[x,1,2], "."]
    , x = rdf[tz+siru]-rdf[tz];
      cat["Yellow Brick Rd = ", shn[x,1,2,{"-","+"}]," / ",unam[runits],"."]]];

  (* Condensed indicator of pings to go till bottom/center/top of road. 
     This is just an ad hoc thing for a few tagtime graphs that dreeves and 
     bsoule and maybe alex have bets on. *)
  pingStr = Module[{a,b,c},
    {a,b,c} = Ceiling /@ (({-1,0,1}*lnw-delta)/PING);
    If[Abs[c]>9, cat["[L",lane,"]"],
      cat["[", If[a<0,"-",shn@a], "/", If[b<0,"-",shn@b], "/", shn@c, "]"]]];

  graphsum = cat[
    If[ugprefix===True, cat[usr,"/",graph,": "], ""],
    shn[vz,1,3]," on ",shd@tz, " (",
    splur[numpts, "datapoint"]," in ",splur[1+Floor[(tz-t0)/SID],"day"], ") ",
    "targeting ", shn[goal,1,3], " on ",shd@gldt," (", 
    splur[shn[cntdn,1,1], "more day"], "). ", ybrStr, (* shn[n,1,4]? *)
    (* ad hoc addendum to graphsum for certain tagtime graphs: *)
    If[MemberQ[{"d/meta", "d/ontask", "b/meta", "a/job"}, usr<>"/"<>graph],
      " "<>pingStr, ""]];

  deltasum = cat[shn[Abs@delta,2,4],
    If[delta<0," below"," above"]," the centerline",
    Which[
    lnw==0, "",
    yaw>0 && (lane==1 || lane==-1),
      cat[" and ",sh1[lnw-delta]," to go till top edge"],
    yaw>0 && lane>=2,
      cat[" and ",sh1[delta-lnw]," above the top edge"],
    yaw>0 && lane<=-2, 
      cat[" and ",sh1[-lnw-delta]," to go till bottom edge"],
    yaw<0 && (lane==1 || lane==-1),
      cat[" and ",sh1[lnw-delta]," below top edge"],
    yaw<0 && lane<=-2,
      cat[" and ",sh1[-lnw-delta]," below bottom edge"],
    yaw<0 && lane>1, 
      cat[" and ",sh1[delta-lnw]," above top edge"],
    True, ""]];

  limsum = Which[
    dir*yaw<0, cat[sh1s[lim[0]-vz]," today"],  (* WEEN or RASH *)
    lnw==0, "n/a",
    yaw>0 && lane>=1,
      cat[sh1s[lim[lane+1]-vz]," within ",splur[lane+1,"day"]],
    yaw>0 && lane==-1, 
      cat[sh1s[lim[lane+2]-vz]," within ",splur[lane+2,"day"]],
    yaw>0 && lane==-2, 
      cat[sh1s[lim[lane+2]-vz]," within ",splur[lane+2,"day"]],
    yaw>0 && lane<=-3, 
      cat[sh1s[lim[0]-vz]," within ",splur[0,"day"]],

    yaw<0 && lane<=-1 && noisy===False,
      cat[sh1s[lim[-lane+1]-vz]," in ",splur[-lane,"day"]],
    yaw<0 && lane<=-1,
      cat[sh1s[lim[-lane]-vz]," in ",splur[-lane,"day"]],
    yaw<0 && lane==1,
      cat[sh1s[lim[lane]-vz]," in ",splur[lane,"day"]],
    yaw<0 && lane>=2 && dir<0,
      cat[sh1s[lim[0]-vz]," in ",splur[0,"day"]],
    yaw<0 && lane>=2 && dir>=0,
      cat[sh1s[lim[lane-1]-vz]," in ",splur[lane-1,"day"]],
    True, "n/a"];

  safeblurb = Which[
    yaw*dir<0,      "unknown days",
    safebuf>999,    "more than 999 days",
    True,           splur[safebuf,"day"]];

  Which[
  loser,
    headsum = "Officially off the yellow brick road";
    lanesum = "officially off the road",
  lnw==0,
    headsum = "Coasting on a currently flat yellow brick road";
    lanesum = "currently on a flat road",
  yaw>0 && dir>0 && lane==1,
    headsum = "Right on track in the top lane of the yellow brick road";
    lanesum = "in the top lane: perfect!",
  yaw>0 && dir>0 && lane==2,
    headsum = "Sitting pretty just above the yellow brick road";
    lanesum = "above the road: awesome!",
  yaw>0 && dir>0 && lane==3,
    headsum = cat["Well above the yellow brick road with ",safeblurb,
                  " of safety buffer"];
    lanesum = cat["well above the road: ",safeblurb," of safety buffer!"],
  yaw>0 && dir>0 && lane>3,
    headsum = cat["Way above the yellow brick road with ",safeblurb,
                  " of safety buffer"];
    lanesum = cat["way above the road: ",safeblurb," of safety buffer!"],
  yaw>0 && dir>0 && lane==-1,
    headsum = "On track but in the wrong lane of the yellow brick road "<>
              "and in danger of losing tomorrow";
    lanesum = "in the wrong lane: could lose tomorrow!",
  yaw>0 && dir>0 && lane<=-2,
    headsum = "Below the yellow brick road and will lose if still here "<>
              "at the end of the day";
    lanesum = "below the road: will lose at end of day!",

  yaw<0 && dir<0 && lane==-1,
    headsum = "Right on track in the right lane of the yellow brick road";
    lanesum = "in the right lane: perfect!",
  yaw<0 && dir<0 && lane==-2,
    headsum = "Sitting pretty just below the yellow brick road";
    lanesum = "below the road: awesome!",
  yaw<0 && dir<0 && lane==-3,
    headsum = cat["Well below the yellow brick road with ",safeblurb,
                  " of safety buffer"];
    lanesum = cat["well below the road: ",safeblurb," of safety buffer!"],
  yaw<0 && dir<0 && lane<-3,
    headsum = cat["Way below the yellow brick road with ",safeblurb,
                  " of safety buffer"];
    lanesum = cat["way below the road: ",safeblurb," of safety buffer!"],
  yaw<0 && dir<0 && lane==1,
    headsum = "On track but in the wrong lane of the yellow brick road "<>
              "and in danger of losing tomorrow";
    lanesum = "in the wrong lane: could lose tomorrow!",
  yaw<0 && dir<0 && lane>=2,
    headsum = "Above the yellow brick road and will lose if still here "<>
              "at the end of the day";
    lanesum = "above the road: will lose at end of day!",
  lane==0,
    headsum = "Precisely on the centerline of the yellow brick road";
    lanesum = "precisely on the centerline: beautiful!",
  lane==1,
    headsum = "In the top lane of the yellow brick road";
    lanesum = "in the top lane",
  lane==-1,
    headsum = "In the bottom lane of the yellow brick road";
    lanesum = "in the bottom lane",
  lane>1,
    headsum = "Above the yellow brick road";
    lanesum = "above the road",
  lane<-1,
    headsum = "Below the yellow brick road";
    lanesum = "below the road"
  ];
  titlesum = cat[colorblurb@dotcolor@{tz,vz}, 
    "bmndr.com/",usr,"/",graph," is ",lanesum,
    If[dir*yaw>0, cat[" (safe to stay flat for ",safeblurb,")"], ""]];

  statsum = If[error=!="", cat[" error:    ",error,"\\n"], cat[
    " progress: ",shd@t0,"  ",If[data=={},"?",sh1@v0d],"\\n",
    "           ",shd@tz,"  ",sh1[vz],"   [",progsum,"]\\n",
    "           ",shd@gldt,"  ",sh1[goal],"\\n",
    " rate:     ",ratesum,"\\n",
    " lane:     ",If[Abs@lane==666,"n/a",lane]," (",lanesum,")\\n",
    " safebuf:  ",safebuf,"\\n",
    " delta:    ",deltasum,"\\n",
    " ",Which[yaw==0, 
      "limit:    ", yaw<0, 
      "hard cap: ", True, 
      "bare min: "], limsum, "\\n"]];
]

(* Takes params as a list of rules like {"foo"->"abc", "bar"->123} and data as a
   list of {timestamp,value} pairs or {timestamp,value,comment} triples.
   Returns a list of p->v pairs giving all the params after defaults and 
   constraints have been applied as well as various stats about the graph like
   where you are relative to the YBR.  It sets these all as global variables as
   well.  One special one it sets is 'error'. genGraph won't try to make a graph
   unless that's the empty string.  In addition it sets the global variable 
   'data'.  genGraph assumes all those are set. Finally, note that all 
   timestamps are translated to unixtime in the retuned list. *)
genStats[p_, d_] := Module[{tmp, err = "", sf = "sanity.txt"},
  tmp = tm[]; (* start the clock immediately *)
  each[a_->v_, p,  (* make sure all supplied params are recognized *)
    If[!MemberQ[Join[pignore,pin[[All,1]]], a], err = err <>
      cat[If[a==="ERROR", v, cat["Unknown param: ",a,"->",InputForm@v]]]]];
  each[a_->v_, DeleteDuplicates[Join[p, pin, pout], #1[[1]]===#2[[1]]&],
    If[!legit[a,v], err=err<> cat["Problem w/ param ",a,"->",InputForm@v,"\n"]];
    eval[a, " = ", InputForm@v]]; (* initialize global var for this param *)
  error = error<>err;
  data = d; (* set the global variable 'data' *)
  proctm = tmp;
  If[FileExistsQ@sf, proctm = tm@FileDate@sf];

  If[error==="", error = init[]];  (* set the global vars for the pout params *)
  If[error==="", sumSet[], 
    statsum = cat[" error:    ",error,"\\n"];
    (*If[$MachineName=!="dreev" && error=!="No datapoints",
      mail[
      "From: bot@kibotzer.com\nTo: dreeves@gmail.com\nCc: bsoule@gmail.com\n",
      "Subject: BBERROR ",usr,"/",graph," ",
       StringTake[StringReplace[error,"\\n"->"  "], Min[80,StringLength@error]],
      "\n\n",error,"\n\n",
      Sequence@@(cat[#1,": ",InputForm@#2,"\n"]& @@@ p),"\n",
      Sequence@@(cat["[",shdt@#1,", ",shn@#2,"],\n"]& @@@ d)]]*)];
  transout[#->eval[#]& /@ Join[pin[[All,1]], pout[[All,1]]]]]

(* An empty graph with a big message instead of, y'know, a graph. *)
emptyGraph[msg_] := Graphics[{Text[Style[msg, Medium]]},
  PlotLabel-> If[!stathead, None, graphsum],
  PlotRangePadding->Scaled[.01], AspectRatio->ASP,
  Frame->True, FrameTicks->All, FrameLabel->{Null, yaxis},
  BaseStyle->{FontFamily->"Geneva", FontSize->9}]

(* Call genStats to set global data, params before calling this. *)
genGraph[] := Module[{dall, a,b, dh,dl},
  If[data==={}, (* there may be other errors but if no data, only say that *)
    If[reset===Null, 
      Return[emptyGraph["No data yet"]]
    , Return[emptyGraph["No data since graph reset on "<>shd@reset]]]];
  If[error=!="", Return@emptyGraph@cat[
    "The following errors prevented us from generating " ,usr,"/",graph,
    ".\n(The bot has notified us of the problem; stand by!)\n\n",
    StringReplace[error,"\\n"->"\n"]]];
  dall = restoreVals[data];
  a = Min[dall[[All,2]]];
  b = Max[dall[[All,2]]];
  ymin = Min[a-Max[lnw/3,(b-a)*.03], v0-lnw, vg-lnw,       (* ymin and ymax   *)
             Select[Most/@road, t0<=#<=tz&][[All,2]]-lnw]; (* are global vars *)
  ymax = Max[b+Max[lnw/3,(b-a)*.03], v0+lnw,vg+lnw, 
             Select[Most/@road, t0<=#<=tz&][[All,2]]+lnw];
  If[ymin==ymax, ymin-=1; ymax+=1];
  If[rosy,
    If[dir>0, {dl,dh} = {inertia[dall, lnw, -1], inertiaRev[dall, lnw, +1]}
    ,         {dl,dh} = {inertiaRev[dall, lnw, -1], inertia[dall, lnw, +1]}]];
  Show[{
    (* do this 1st to establish plot range; must incl target & must be dlp: *)
    dlp[{{t0,v0}, {tg,vg}}, PointSize[0], PRAL], (* dummy datelistplot *)
    If[aura,
      {grAura[dall], grWatermark[], grRoad[], grRazor[], grOverlap[dall],
       If[yaw===0, {}, {grGuidelines[], grOverlapGL[dall]}]}
    , {grWatermark[], grRoad[], grRazor[],
       If[yaw===0, {}, grGuidelines[]]}],
    grCenterline[],
    grAhorizon[],
    If[movingav, dlp[
      Transpose @ {#1, ExponentialMovingAverage[#2, .1]}& @@ Transpose@dall,
      Purple,JOIN,PRAL], {}],
    grBullseye[If[gldt<tg, {gldt,rdf[gldt]}, {tg,vg}]],
    If[steppy,  (* make the steppy purple line connecting purple dots *)
      {dlp[dall, {PTSZ[2*1.5^2scl[]], PURP}, PRAL],
       dlp[addStepPoints@dall, {THCK[1.4scl[]], PURP}, JOIN,PRAL]}, {}],
    If[rosy, (* rose-colored dots & rosy line connecting them *)
      {dlp[(dl+dh)/2, {PTSZ[2*1.5^2scl[]], ROSE}, PRAL],
       dlp[(dl+dh)/2, {THCK[1.4scl[]],ROSE}, JOIN,PRAL]}, {}],
    grDots[dall]
    },
    PlotLabel->If[stathead, graphsum, None],
    PlotRange->{{t0,tg},{ymin,ymax}}, PlotRangePadding->Scaled[.01], 
    AspectRatio->ASP, Frame->True, FrameLabel->{Null,yaxis},
    BaseStyle->{FontFamily->"Geneva", FontSize->9}]]

(* Given a Graphics object, p, as returned by genGraph above, export it to the 
   given filename, f. *)
genImage[p_, f_] := Export[f, p, ImageSize->imgsz]

(* Returns the width and height of the full graph image, in pixels. 
   Not currently used. *)
imgdim[p_Graphics] := Rasterize[p, "RasterSize", ImageSize->imgsz]

(* Returns the geometry of the box to crop out for the thumbnail: 
   {width, height, x offset, y offset}. 
   They are all given in pixels for the full image so they need to be rescaled 
   for the thumbnail. *)
cropvals[p_Graphics] := Module[{q, x1, y1, x2, y2, tmp},
  q = Show[p, Prolog->{Annotation[Rectangle[Scaled[{0,0}], Scaled[{1,1}]], 
                                  "BEEMAGIC00","BEEMAGIC11"]}];
  tmp = tm[];
  {{x1,y1}, {x2,y2}} = Rasterize[q, "Regions", ImageSize->imgsz][[1,2]];
  {x2-x1, y2-y1, x1, y1}]

(* Take the plot as returned by genGraph, the filename, i, of the graph image 
   like "path/to/foo.png" and generate a corresponding thumbnail at the given 
   filename, t.  (This needs the actual plot -- the Graphics object -- so it
   can figure out where to crop it.)  See also the comments on genImage. *)
genThumb[p_, i_String, t_String] := Module[{w,h, x,y, s,sp, tmp},
  s = 3/10;  (* fraction to scale the image by to make the thumb *)
  sp = Round[100s];  (* scale as a percentage *)
  (* prn[" (DEBUG: thumb is ",If[!FileExistsQ[t],"N/A ",proctm-tm@FileDate[t]],
      "s old)"]; *)
  (* oops, this thumb-lagging will never generate a new thumb as long as we 
     keep regenerating the border since that counts as modifying the file *)
  If[True || !FileExistsQ[t] || proctm - tm@FileDate[t] > 86400*3.5,
    {w,h, x,y} = Round /@ (cropvals[p]*s);
    tmp = tm[];
    system["/usr/bin/convert -resize ",sp,"% -crop ",
           w-2,"x",h-2,"+",x+1,"+",y+1,
           " -type PaletteMatte -depth 8 ",i," ",t];
  , (* else: thumb file exists and is recent, so only regenerate its border *)
    system["/usr/bin/convert -shave 2x2 ",t," "t];
  ];
  tmp = tm[];
  system["/usr/bin/convert -bordercolor '",
         colorstring@dotcolor[{tz,vz}],"' -border 2x2 ",t," ",t];
]

(* SCHDEL: {w0,h0} = Round /@ (imgdim[p]*3/10); *)
(* Very rough way to guess crop box before finding the Rasterize trick:
  n = Max[StringLength@shn[v0], StringLength@shn[vg]];
  w0 = 294;
  h0 = 210;
  x = Round@cvx[n, {1,6}, {10,21}];
  y = Round@cvx[n, {1,6}, {12,14}];
  w = Round@cvx[n, {1,6}, {280,258}];
  h = Round@cvx[n, {1,6}, {184,181}];
*)
(* Original compromise version with frames: (when imgsz was fixed at 800)
system["/usr/bin/convert -resize 294x210! -crop 273x181+14+14! ",
       "-type PaletteMatte -depth 8 ",i," ",t];
system["/usr/bin/convert -bordercolor '#CCCCCC' -border 1x2 ",t," ",t] *)
(* Original command to make thumbnails, before adding frame: *)
(* system["/usr/bin/convert -resize 294x210 -crop 277x175+12+9 +repage ",
          "-type PaletteMatte -depth 8 ", base, ".png ", thbase, ".png]; *)

(******************************************************************************)
(********************************* SEND EMAIL *********************************)

(* Takes string giving recent datapoints and sends an email. NO LONGER USED. *)
beemail[recent_String] := If[sendmail && email=!="", 
  prn[" Sending mail to ",email];
  mail[
  "From: Beeminder Bot <bot@kibotzer.com>\nTo: ",email,"\n",
  "Reply-To: bot@beeminder.com\n",
  (* "Bcc: help@kibotzer.com\n", *)
  (* NB: if we change subject line here, change email.pl to match *)
  "Subject: ",lanesum," (bmndr.com/",usr,"/",graph,")\n\n",
  "Your graph is updated: http://beeminder.com/",usr,"/",graph, "\n\n",
  "Recent data points:\n\n",
  recent, (* backtick["tail -7 "<>base<>".kib.2"], *) 
  "\n\n",
  "Random Beeminder tip of the day from Melanie, resident fitness expert:\n\n",
  backtick[path<>"randtip.pl"],
  "\n\n-- \n",
  "Reply to this or any email from the bot with more datapoints.\n"]]


(******************************************************************************)
(****************** PARSE PARAMETERS AND DATA KIBOTZER-STYLE ******************)

(* Parse a string with params followed by data in the original .kib format. 
   NOT USED ANYMORE.
   Can also pass it as a list of lines, which is what readList[] returns. 
   Returns {p,d} where p is the params string and d is the data string. 
   (Also works for .usr files, returning {p,g} where p is the params string and
    g is the string containing the gallery of graphs.) *)
parseKib[kibstr_String] := parseKib[StringSplit[kibstr, "\n"]]
parseKib[kiblines_List] := Module[{tmp, paramlines, datalines},
  tmp = Join[{""}, kiblines, {""}];
  tmp = SplitBy[tmp, StringMatchQ[#, re@"^\\-{4,}"]&];
  {paramlines,tmp,datalines} = tmp;
  paramlines = Rest@paramlines;
  datalines = Most@datalines;
  {cat@@Riffle[paramlines, "\n"], cat@@Riffle[datalines, "\n"]}]

(* Parse params like in original .kib format into a list of rules. 
   NOT USED ANYMORE.
   For example, this (which is one big string)
     foo = "abc";
     bar = {1,2,3}; 
   gets turned into this:
     {"foo" -> "abc", "bar" -> {1,2,3}} *)
parseParams[""] = {};
parseParams[s_] := If[!SyntaxQ[s], {"ERROR"->"Syntax error in params"},
  DeleteCases[ReleaseHold[eval@StringReplace[cat@FullForm@eval[
    "Hold@{", StringReplace[s, {"=" -> "(*MAGIC=*)->",
                                ";" -> "(*MAGIC;*),"}], "Null}"],
                               {"(*MAGIC=*)->" -> "=",
                                "(*MAGIC;*)," -> ";"}] /. 
    (sym_->e_) :> (SymbolName[Unevaluated[sym]]->e)], Null]]

(* Pad-from-previous: used for parsing data file. This allows bare values 
   with no date, in which case it assumes 1 day after the previous datapoint's 
   date. But we complain about that since it's no longer supported. 
   NOT CURRENTLY USED. *)
pfp[{y0_,m0_,d0_, v0_}, x_] := Module[{y,m,d, v},
  {y,m,d,v} = PadLeft[x, 4, 0];
  If[y==0, y = y0];
  If[m==0, m = m0];
  If[d==0, {y,m,d} = DatePlus[{y0,m0,d0}, 1];  
           prn["WARNING: inferred date ", {y,m,d}, " for bare datapoint ", v]];
  {y,m,d, v}]

(* Takes data as a big string (lines of user-entered data, ie, newline-separated
   urtexts) and returns a list of {datelist, value, comment} triples, not 
   sorted, just in the order provided.  NOT CURRENTLY USED. *)
parseRaw[datastr_] := Module[{prev = Null, tmp, date,val,comment, x, reaped},
  reaped = Reap[each[line_, StringSplit[datastr, "\n"],
    tmp = StringCases[line, re[
     "^\\s*((?:[\\d\\.]+\\s+){1,3})([\\-\\d\\+\\.]+)\\s*(?:\\\"(.*)\\\"\\s*)?$"]
      -> {"$1", "$2", "$3"}];
    If[tmp==={}, prn["ERROR: unparsable datapoint:\n", line];
    , {date, val, comment} = tmp[[1]];
      x = Append[ImportString[date, "Table"][[1]], val];
      If[prev=!=Null, x = pfp[prev, x]];
      prev = x;
      Sow[{Most[x], eval[val], comment}]]]][[2]];
  If[reaped==={}, {}, reaped[[1]]]]

(* Takes data as a big string (like the contents of a .kib.2 file -- lines of 
   user-entered data) and returns a list of {timestamp, value} pairs, sorted by 
   time.  NOT USED ANYMORE. *)
parseData[datastr_] := Module[{text, data},
  text = datastr;
  text = StringReplace[text, re@"\\\".*\\\"" -> ""];
  data = Select[ImportString[text, "Table"], #=!={}&];
  If[data==={}, Return[{}]];
  (* stable sort: honor original ordering for datapoints w/ same timestamp *)
  SortBy[{tm@Most@#, Last@#}& /@ FoldList[pfp, First@data, Rest@data], {First}]]

(* Takes raw (parsed) data with comments (what parseRaw returns) and writes csv
   to the specified file. WARNING: stackoverflow.com/q/2768958 
   NOT USED ANYMORE. *)
csvData[datac_, csvfile_] := Export[csvfile, Flatten /@ datac, "CSV"]

(* Takes raw (parsed) data with comments, writes PRJ's format to given file. 
   NOT USED ANYMORE. *)
prjData[datac_, datfile_] := Module[{s = OpenWrite[datfile]},
  each[{{y_,m_,d_}, v_, c_}, datac,
    WriteString[s, c," [",v," @ ",y,".",m,".",Floor[d],"]\n"]];
  Close[s]]


(******************************************************************************)
(*************************** SCHEDULED FOR DELETION ***************************)

(* Underspecified rows of the road matrix are no longer supported so the 
following is moot. *)
(* Helper for genRdMtx: compute the global rate given global t, v, and 
   underspecified road matrix. For now just use the average rate from (t0,v0) to
   (t,v). The possibly Really Right way to do this when a global gldt and goal 
   (but no rate) are specified:  Underspecified road segments with no rate
   specified should be given rates that are all the same, if possible. 
   What we actually do currently is the following worse-is-better approach:
   If there's, for example, a long flat spot between (t0,v0) and the globally 
   specified goal (t,v) then the initial segment will be shallow, matching the 
   overall average rate, and the final segment will have to be super steep to 
   make up for the flat spot. So it's a bit myopic. Ideally you'd make both the 
   segments before and after the flat spot be equally steep. That's not so hard
   if all the road segments have end times specified. Then you can get the 
   global rate (what this function returns) by snipping out all the segments 
   that do have rates (non-underspecified segments) and stitching them back 
   together. Ie, sum up the delta t's and the delta v's for all 
   non-underspecified segments, subtract the sums from (t,v) and then compute 
   the rate from (t0,v0) to (t,v). *)
(* grate[t_,v_, m_] := tvr[t,v,Null, t0,v0] *)

(* Transform data by subtracting v from all datapoints on or after t. *)
(* tarify[data_, t_, v_] := {#1, If[#1>=t, #2-v, #2]}& @@@ data *)

(*
genRateFunc0[] := Function[x, 1/siru * If[exprd, rdf[x], 1] *
  With[{rl = Select[road, #[[1]] > x&, 1]}, If[rl==={}, 0, rl[[1,3]]]]]
*)

(*
stp0[x_][{{x1_,y1_}, {x2_,y2_}}] := {y1, x1 <= x < x2}
stepify0[{},    default_:0] := (default&)
stepify0[data_, default_:0] := With[{x0 = data[[1,1]], y_z = data[[-1,2]]},
  Piecewise[Join[{{default, #<x0}}, stp0[#] /@ Partition[data,2,1]], y_z]&]
*)
(* This should be faster though doesn't seem to matter in practice. *)
(*
stepify1[{},    default_:0, min_:-9^99, max_:9^99] := (default&)
stepify1[data_, default_:0, min_:-9^99, max_:9^99] := With[{f = Interpolation[
    {-1,1}*#& /@ Join[{{min,default}}, data, {{max,data[[-1,2]]}}], 
    InterpolationOrder->0]}, 
  f[-#]&]
*)

(* Aborted attempt at a more efficient genRateFunc:
stepify2[{},    default_:0, min_:-9^99, max_:9^99] := (default&)
stepify2[data_, default_:0, min_:-9^99, max_:9^99] :=
  Interpolation[Join[{{t0,default}}, data, {{max, data[[-1,2]]}}],
                InterpolationOrder->0]
genRateFunc1[] := (1/siru*If[exprd, rdf[#], 1] * 
  stepify2[DeleteDuplicates[road[[All,{1,3}]]]][#]&)
*)

(* Original lane width function. SCHDEL. *)
(* For noisy graphs, compute the lane width based on the data and YBR rate.
   If there's only one datapoint (t,v) on a flat road then lane = 5% of v.
   If one datapoint and road not flat then use the daily rate as the lane width.
   Otherwise, compute the lane width for every pair of datapoints and take the 
   max.  The lane width for a pair of points is the max of the daily rate and 
   the daily deviation of the values of the points, decayed exponentially so
   that the deviation is multiplied by 50% if it's 30 days in the past.
   Finally, the lane width for a pair of points is maxed with the lane width
   needed to ensure the property that you can't lose tomorrow if you're in the
   right lane today. *)
(*
origLaneWidth[{{t_,v_}}] := If[avgrt==0, v/20, Abs[rdf[t]-rdf[t+SID]]]
origLaneWidth[data_] := Max[laneWidth0 /@ Partition[data, 2, 1]]
laneWidth0[{{t_,v1_},{t_,v2_}}] := Abs[v1-v2]
laneWidth0[{{t1_,v1_}, {t2_,v2_}}] := Max[
  Abs[rdf[t1]-rdf[t1+SID]],  (* daily rate of the YBR *)
  Abs[v1-v2]/(t2-t1)*SID*Exp[Log[ .50 ] / 30 / SID]^(tz-t2),
  If[t2-t1 == SID && (avgrt<0 && v1<rdf[t1] && v2>rdf[t2] ||
                      avgrt>0 && v1>rdf[t1] && v2<rdf[t2]),    
    Abs[v2-rdf[t2]]
  , 0]]
*)

(*
UPOCH = 2208967200; (* unix time 0 is this in mma's absolutetime SCHDEL c *) 
UPOCH = 2208988800; (* unix time 0 is this in mma's absolutetime SCHDEL e *)
*)

(* Hacked up, ad hoc version of road = linInterp...
  This would've been Thanksgiving 2010 or 2011, before YBRs supported flat spots
  If[thanksgiving===True,
    road = Which[
                #<28,  (g-a)/vi[g,a,r]*(#-0) +((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r],
            (* 2-day flat spot for thanksgiving: *)
            28<=#<=30, (g-a)/vi[g,a,r]*(28-0)+((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r],
            30<#<38,   (g-a)/vi[g,a,r]*(#-2) +((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r],
            (* 2-day flat spot for sanibel: *)
            38<=#<=40, (g-a)/vi[g,a,r]*(38-2)+((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r],
            40<#<42,   (g-a)/vi[g,a,r]*(#-4) +((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r],
            (* 3-day flat spot for being sick *)
            42<=#<=45, (g-a)/vi[g,a,r]*(42-4)+((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r],
            45<#<57,   (g-a)/vi[g,a,r]*(#-7) +((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r],
            (* 7-day flat spot for xmas and new years *)
            57<=#<=64, (g-a)/vi[g,a,r]*(57-7)+((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r],
            True,      (g-a)/vi[g,a,r]*(#-14)+((sn+vi[g,a,r])*a-sn*g)/vi[g,a,r]
           ]&,
*)

(* we want the centerline to start above the initial datapoint (0 for a kyoom 
graph) by an amount equal to the daily rate (ie, the lane width).
That's also equivalent to having the road start at the current datapoint (or 0 
for kyoom) but one day earlier.
So here we temporarily set it to one day earlier and use that as the road start
so that we can compute the rate.
After we know the rate we can move t0 back to the right day and v0 up by the 
daily rate. *)

(*
fillZeros[{}] = {};
fillZeros[data_] := Module[{data0 = data, start, end, given, zeros},
  start = data0[[1,1]];
  end = data0[[-1,1]];    (* was: end = Max[tm[], data0[[-1,1]]] *)
  each[{t_, x_}, data0,  given[t] = 1];
  zeros = Select[Range[start,end, SID], given[#]=!=1&];
  data0 = SortBy[Join[data0, {#,0}&/@zeros], {First}]; (* wait, not 0, prev *)
  data0]
*)

(* Given any of the 8 subsets of {gldt, goal, srate} -- specified here as 
   {t,v,r} with Nulls for the missing ones -- return {t,v,r} with the missing 
   ones filled in.  If there's more than one Null then it's underspecified and
   we do the following:
   Default to a flat road if only end time is given. If only goal or rate is 
   given, default to an end time of t0 plus a year. If nothing is given, default
   to a flat road that extends for a year. *)

(* This was at the beginning of genRoadFunc[] before but seems to be moot now:
  t0 = N@t0; (* weirdly, clunis/writing's centerline doesn't show up 
                unless we do this. *)
*)

(* Takes {timestamp,value} pairs, returns {t,d} where d is the max recent 
   one-day absolute deviation and t is the timestamp of the start of that
   deviation, ie, there was a deviation of d between t and t + 1 day. *)
(*  replaced by maxUp
getDelta[data_] := Module[{data0, nums,values,gaps,deltas},
  data0 = numify[{DateList[#1], #2}& @@@ data];
  {nums,values} = Transpose@data0;
  gaps = Differences[nums];
  deltas = Abs@Differences[values];
  Clip[Max@Pick[deltas, (#==1&) /@ gaps], {0,Infinity}]]
*)

(* Takes {timestamp,value} pairs, returns {t,d} where d is the max recent 
   one-day increase, ie, there was a jump up of d between t and t + 1 day. *)
(* replaced with noisyWidth[]
maxUp[data_] := Module[{data0, t, v, gaps, deltas},
  data0 = floorify[data];
  {t, v} = Transpose[data0];
  gaps = Differences[t];
  deltas = Differences[v];
  Clip[Max@Pick[deltas, (#==SID&) /@ gaps], {0, Infinity}]]
*)
