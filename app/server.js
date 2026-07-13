"use strict";

const BHOST    = "www.beeminder.com";
const BASEURL  = "https://www.beeminder.com/api/v1/users/";

require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const Sequelize = require("sequelize");
const axios = require("axios");

const ver = require("../package.json").version; // version string

// Set session store to Sequelize
const SequelizeStore = require("connect-session-sequelize")(session.Store);

const app = express(); // initialize the app

// Placeholder function for session-related logic. Chesterton's fence I guess.
// function setsession(req) {}

// Enable cookies via HTTPS
app.set("trust proxy", 1);
app.set("view engine", "ejs");

// Enable JSON request parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let User = null; // initialize global model class for user

// Set up a new database using database credentials set in .env
const sequelize = new Sequelize(
  "database",
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: "0.0.0.0",
    dialect: "sqlite",
    pool: {
      max: 5,
      min: 0,
      idle: 10000,
    },
    // Security note: the database is saved to the file `database.sqlite` in
    // the local filesystem. It's deliberately placed in the `.data` directory
    // which doesn't get copied if someone remixes the project on Glitch.
    storage: ".data/database.sqlite",
  }
);

// Set up session parameters
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store: new SequelizeStore({ db: sequelize }),
    saveUninitialized: false,
    resave: false,
    cookie: { secure: process.env.NODE_ENV !== "development" },
    trustProxy: true, // probably redundant with app.set("trust proxy", 1) above
  })
);

// Connect to the database and define Models
sequelize
  .authenticate()
  .then((err) => {
    console.log("Database connection established.");
    User = sequelize.define("users", { // define table 'users'
      username:     { type: Sequelize.STRING },
      access_token: { type: Sequelize.STRING },
    });
    sequelize.sync(); // create table User if it does not exist
  })
  .catch((err) => {
    console.log("Unable to connect to the database: ", err);
  });

// Stuff in the pub directory is served statically
app.use("/staticdesign", express.static("quals/generated/grapheditor.html"));
app.use("/tutorial",     express.static("quals/tutorial.html"));
app.use("/newgoal",      express.static("quals/newgoal.html"));
app.use("/src",          express.static("src"));       // js served through /src
app.use("/data",         express.static("data"));  // bb files served thru /data
app.use("/lib",          express.static("lib"));  // js/css/etc served thru /lib

const listener = app.listen(process.env.PORT, () => {
  console.log(`Graph Editor app is running on port ${listener.address().port}`);
  console.log(`AUTH_REDIRECT_URI is ${process.env.AUTH_REDIRECT_URI}`);
});
listener.on("error", (err) => {
  console.error(`FATAL: failed to bind port ${process.env.PORT}: ${err.code || err.message}`);
  process.exit(1);
});

app.get("/login", (req, resp) => {
  //setsession(req);
  console.log("!!!! GOT LOGIN !!!!");
  console.log(req.session);
  if (typeof req.session.access_token === "undefined" ||
      req.session.access_token === null) {
    resp.render("login.ejs", {
      BEEMINDER_CLIENT_ID: process.env.BEEMINDER_CLIENT_ID,
      AUTH_REDIRECT_URI:   process.env.AUTH_REDIRECT_URI,
      version: ver,
    });
  } else {
    // Land wherever the visitor was originally headed (e.g. a deep link
    // to /username/goalname stashed below), defaulting to the editor
    const dest = req.session.wanted || "/";
    delete req.session.wanted;
    resp.redirect(dest);
  }
});
app.get("/newdesign", (req, resp) => { resp.redirect("/") });
app.get("/road", (req, resp) => {
  //setsession(req);
  if (typeof req.session.access_token === "undefined" ||
      req.session.access_token === null) {
    resp.redirect("/login");
  } else {
    const user = {
      username:     req.session.username,
      access_token: req.session.access_token,
    };
    resp.render("grapheditor.ejs", { user: user, version: ver, goal: null,
                                     wanted: null });
  }
});
// Retired pages (the pre-2026 "olddesign" UI) redirect to the graph editor
app.get("/olddesign", (req, resp) => { resp.redirect("/") });
app.get("/editor",    (req, resp) => { resp.redirect("/") });
app.get("/sandbox", (req, resp) => { resp.render("sandbox.ejs", { version: ver }) });
app.get("/", (req, resp) => {
  //setsession(req);
  
  // Check if this is a social media crawler requesting meta tags
  const ua = (req.get('User-Agent') || '').toLowerCase();
  const socialCrawlers = [
    'twitterbot',          // covers “Twitterbot/2.0” etc.
    'facebookexternalhit',
    'linkedinbot',
    'whatsapp',
    'telegrambot',
    'skypeuripreview',
    'slackbot',
    'discordbot'
  ];
  const isBot = socialCrawlers.some(sig => ua.includes(sig));

  if (isBot) { // 200 OK with card tags
    return resp.render('login.ejs', {
      BEEMINDER_CLIENT_ID: process.env.BEEMINDER_CLIENT_ID,
      AUTH_REDIRECT_URI:   process.env.AUTH_REDIRECT_URI,
      version:             ver,
    });
  }

  if (!req.session?.access_token) {
    return resp.redirect('/login');   // humans hit the normal flow
  }

  resp.render('grapheditor.ejs', {
    user: {
      username:     req.session.username,
      access_token: req.session.access_token,
    },
    version: ver,
    goal: null,
    wanted: null,
  });
});

// Callback endpoint to receive username and access_token from Beeminder upon
// successful authorization
app.get("/connect", (req, resp) => {
  if (typeof req.query.access_token === "undefined" ||
      typeof req.query.username     === "undefined") {
    req.session.access_token = null;
    req.session.username     = null;
    if (typeof req.query.error != "undefined") {
      req.session.error             = req.query.error;
      req.session.error_description = req.query.error_description;
    }
  } else {
    //console.log("Setting session", req.query.access_token, req.query.username);
    //console.log(process.env);
    req.session.access_token = req.query.access_token;
    req.session.username     = req.query.username;
  }
  resp.redirect("/login");
});

app.get("/logout", (req, resp) => {
  req.session.access_token = null;
  req.session.username     = null;
  resp.redirect("/");
});

app.get("/getusergoals", async (req, resp) => {
  //setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.status(401).json({error: "Not authenticated"});
    return;
  }
  try {
    const goals = await beemGetUser({
      username:     req.session.username,
      access_token: req.session.access_token,
    });
    resp.send(JSON.stringify(goals));
  } catch (error) {
    console.log(error);
    resp.status(500).send("An error occurred.");
  }
});
app.get("/getgoaljson/:goal", async (req, resp) => {
  //setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
    return;
  }
  try {
    const goals = await beemGetGraphParams({
      username:     req.session.username,
      goalname:     req.params.goal,
      access_token: req.session.access_token,
    });
    resp.send(JSON.stringify(goals));
  } catch (error) {
    console.log(error);
    resp.status(500).send("An error occurred.");
  }
});

app.post("/submitroad/:goal", async (req, resp) => {
  //setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
    return;
  }
  try {
    const body = await beemSubmitRoad({
      usr:          req.session.username,
      gol:          req.params.goal,
      access_token: req.session.access_token,
      roadall:      JSON.stringify(req.body.road),
    });
    resp.send(body);
  } catch (error) {
    console.error("submit failed:", error);
    const status = error.response?.status || 500;
    // Send the API's response body so client can check resp.error
    const body = error.response?.data || {error: error.message || "Unknown error"};
    resp.status(status).send(body);
  }
});

app.post("/data/:goal", async (req, resp) => {
  //setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
    return;
  }
  try {
    const body = await beemSubmitPoint({
      usr:          req.session.username,
      gol:          req.params.goal,
      access_token: req.session.access_token,
      daystamp:     req.body.daystamp,
      timestamp:    req.body.timestamp,
      value:        req.body.value,
      comment:      req.body.comment,
    });
    resp.send(body);
  } catch (error) {
    console.error("submit point failed:", error);
    resp.status(500).send("An error occurred.");
  }
});

app.delete("/data/:goal/:id", async (req, resp) => {
  //setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
    return;
  }
  try {
    const body = await beemDeletePoint({
      usr:          req.session.username,
      gol:          req.params.goal,
      access_token: req.session.access_token,
      id:           req.params.id,
    });
    resp.send(body);
  } catch (error) {
    console.error("delete point failed:", error);
    resp.status(500).send("An error occurred.");
  }
});

app.put("/data/:goal/:id", async (req, resp) => {
  //setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
    return;
  }
  try {
    const body = await beemUpdatePoint({
      usr:          req.session.username,
      gol:          req.params.goal,
      access_token: req.session.access_token,
      id:           req.params.id,
      timestamp:    req.body.timestamp,
      value:        req.body.value,
      comment:      req.body.comment,
    });
    resp.send(body);
  } catch (error) {
    console.error("update point failed:", error);
    resp.status(500).send("An error occurred.");
  }
});

// Deep link to a specific goal (graph.beeminder.com/username/goalname) or
// to a user's goals generally (graph.beeminder.com/username, which lands
// on their first goal). Registered after every other route so real paths
// always win. The username has to match the session (this tool only holds
// your own token); anyone else -- including logged-out visitors -- goes
// to login.
app.get(["/:username", "/:username/:goalname"], (req, resp, next) => {
  // Usernames and goalnames are alphanumeric plus underscore (no dots or
  // hyphens), so a path that can't be a name -- like any file request,
  // which has a dot in it -- is not a deep link and 404s just like it did
  // before this route existed
  const namepat = /^[a-zA-Z0-9_]+$/;
  const { username, goalname } = req.params; // goalname undefined on /username
  const names = goalname ? [username, goalname] : [username];
  if (!names.every(n => namepat.test(n))) return next();
  if (!req.session?.access_token) {
    // Come back here after logging in. Rebuilt from the route params --
    // just proved to be plain names -- so what we later redirect to is
    // always a local path and never, say, an absolute URL off to someone
    // else's site.
    req.session.wanted = "/" + names.join("/");
    return resp.redirect("/login");
  }
  const mismatch = username !== req.session.username;
  resp.render("grapheditor.ejs", {
    user: {
      username:     req.session.username,
      access_token: req.session.access_token,
    },
    version: ver,
    // Signed in as someone else: show their own goals with a banner
    // explaining what was asked for, instead of a silent teleport
    goal:   mismatch ? null : goalname ?? null,
    wanted: mismatch ? names.join("/") : null,
  });
});

// helper functions
async function beemSubmitRoad(params) {
  const url = `${BASEURL}${params.usr}/goals/${params.gol}.json`;
  const body = {
    access_token: params.access_token,
    roadall:      params.roadall,
  };
  const response = await axios.put(url, body);
  return response.data;
}

async function beemSubmitPoint(params) {
  const r = Math.random().toString(36).substring(7);
  const url = `${BASEURL}${params.usr}/goals/${params.gol}/datapoints.json`;
  const data = new URLSearchParams({
    access_token: params.access_token,
    daystamp:     params.daystamp,
    comment:      params.comment,
    value:        params.value,
    requestid:    r,
  });
  const response = await axios.post(url, data);
  return response.data;
}

async function beemDeletePoint(params) {
  const url = 
    `${BASEURL}${params.usr}/goals/${params.gol}/datapoints/${params.id}.json`;
  const data = new URLSearchParams({ access_token: params.access_token });
  const response = await axios.delete(url, { data });
  return response.data;
}

async function beemUpdatePoint(params) {
  const url = 
    `${BASEURL}${params.usr}/goals/${params.gol}/datapoints/${params.id}.json`;
  const data = new URLSearchParams({
    access_token: params.access_token,
    timestamp:    params.timestamp,
    comment:      params.comment,
    value:        params.value,
  });
  const response = await axios.put(url, data);
  return response.data;
}

async function beemGetUser(user) {
  const url = `https://${BHOST}/api/v1/users/${user.username}` + 
              `.json?access_token=${user.access_token}`;
  const response = await axios.get(url);
  return response.data.goals;
}

async function beemGetGraphParams(usergoal) {
  const url = `https://${BHOST}/api/vx/users/${usergoal.username}/goals/` +
        `${usergoal.goalname}/graph.json?access_token=${usergoal.access_token}`;
  const response = await axios.get(url);
  return response.data;
}
