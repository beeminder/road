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
app.use("/staticdesign", express.static("quals/generated/newdesign.html"));
app.use("/tutorial",     express.static("quals/tutorial.html"));
app.use("/newgoal",      express.static("quals/newgoal.html"));
app.use("/src",          express.static("src"));       // js served through /src
app.use("/data",         express.static("data"));  // bb files served thru /data
app.use("/lib",          express.static("lib"));  // js/css/etc served thru /lib

const listener = app.listen(process.env.PORT, () => {
  console.log(`Graph Editor app is running on port ${listener.address().port}`);
  console.log(`AUTH_REDIRECT_URI is ${process.env.AUTH_REDIRECT_URI}`);
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
    resp.redirect("/");
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
    resp.render("newdesign.ejs", { user: user });
  }
});
app.get("/olddesign", (req, resp) => {
  //setsession(req);
  if (typeof req.session.access_token === "undefined" ||
      req.session.access_token === null) {
    resp.redirect("/login");
  } else {
    const user = {
      username:     req.session.username,
      access_token: req.session.access_token,
    };
    resp.render("road.ejs", { user: user });
  }
});
app.get("/editor", (req, resp) => { resp.render("road.ejs", { user: null }) });
app.get("/sandbox", (req, resp) => { resp.render("sandbox.ejs") });
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

  resp.render('newdesign.ejs', {
    user: {
      username:     req.session.username,
      access_token: req.session.access_token,
    }
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
    console.log("Setting session", req.query.access_token, req.query.username);
    console.log(process.env);
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
