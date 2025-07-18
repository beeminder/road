"use strict";
// -------------------------------- (80chars) --------------------------------->

require("dotenv").config();

var express = require("express");
var https = require("https");
var http = require("http");
var bodyParser = require("body-parser");
var session = require("express-session");
var Sequelize = require("sequelize");
var request = require("request");

// Read package.json to get version
var packageJson = require("../package.json");

// Setting session store to Sequelize
var SequelizeStore = require("connect-session-sequelize")(session.Store);

// Initializing the app
var app = express();

// Placeholder function for session-related logic. Chesterton's fence I guess.
function setsession(req) {}

// Enabling cookies via HTTPS
app.set("trust proxy", 1);
app.set("view engine", "ejs");

// Enabling JSON request parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initiate global model class for user
var User = null;

// Setting up a new database using database credentials set in .env
var sequelize = new Sequelize(
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
    // which doesn't get copied if someone remixes the project.
    storage: ".data/database.sqlite",
  }
);

// Setting up session parameters
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store: new SequelizeStore({ db: sequelize }),
    saveUninitialized: false,
    resave: false,
    cookie: { secure: process.env.NODE_ENV !== "development" },
    trustProxie: true,
  })
);

// Connecting to the database and defining Models
sequelize
  .authenticate()
  .then((err) => {
    console.log("Database connection established.");
    User = sequelize.define("users", {
      // Defining table 'users'
      username: { type: Sequelize.STRING },
      access_token: { type: Sequelize.STRING },
    });
    sequelize.sync(); // Creating table User if it does not exist
  })
  .catch((err) => {
    console.log("Unable to connect to the database: ", err);
  });

// Stuff in the pub directory is served statically
app.use("/staticdesign", express.static("tests/generated/newdesign.html"));
app.use("/tutorial", express.static("tests/tutorial.html"));
app.use("/newgoal", express.static("tests/newgoal.html"));
// Serve js files under the src directory through /src
app.use("/src", express.static("src"));
// Serve BB files under the data directory through /data
app.use("/data", express.static("data"));
// Serve JS, CSS and other files under the list directory in /lib
app.use("/lib", express.static("lib"));

var listener = app.listen(process.env.PORT, () => {
  console.log(`Graph Editor app is running on port ${listener.address().port}`);
  console.log(`AUTH_REDIRECT_URI is ${process.env.AUTH_REDIRECT_URI}`);
});

app.get("/login", (req, resp) => {
  setsession(req);
  console.log("!!!! GOT LOGIN !!!!");
  console.log(req.session);
  if (
    typeof req.session.access_token === "undefined" ||
    req.session.access_token === null
  ) {
    resp.render("login.ejs", {
      BEEMINDER_CLIENT_ID: process.env.BEEMINDER_CLIENT_ID,
      AUTH_REDIRECT_URI: process.env.AUTH_REDIRECT_URI,
      version: packageJson.version,
    });
  } else {
    resp.redirect("/");
  }
});
app.get("/newdesign", (req, resp) => {
  resp.redirect("/");
});
app.get("/road", (req, resp) => {
  setsession(req);
  if (
    typeof req.session.access_token === "undefined" ||
    req.session.access_token === null
  ) {
    resp.redirect("/login");
  } else {
    var user = {
      username:     req.session.username,
      access_token: req.session.access_token,
    };
    resp.render("newdesign.ejs", { user: user });
  }
});
app.get("/olddesign", (req, resp) => {
  setsession(req);
  if (
    typeof req.session.access_token === "undefined" ||
    req.session.access_token === null
  ) {
    resp.redirect("/login");
  } else {
    var user = {
      username: req.session.username,
      access_token: req.session.access_token,
    };
    resp.render("road.ejs", { user: user });
  }
});
app.get("/editor", (req, resp) => {
  resp.render("road.ejs", { user: null });
});
app.get("/sandbox", (req, resp) => {
  resp.render("sandbox.ejs");
});
app.get("/", (req, resp) => {
  setsession(req);
  
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

  if (isBot) {
    // 200 OK with card tags
    return resp.render('login.ejs', {
      BEEMINDER_CLIENT_ID: process.env.BEEMINDER_CLIENT_ID,
      AUTH_REDIRECT_URI:  process.env.AUTH_REDIRECT_URI,
      version:            packageJson.version
    });
  }

  if (!req.session?.access_token) {
    return resp.redirect('/login');   // humans hit the normal flow
  }

  resp.render('newdesign.ejs', {
    user: {
      username:      req.session.username,
      access_token:  req.session.access_token
    }
  });
});

// Callback endpoint to receive username and access_token from Beeminder upon
// successful authorization
app.get("/connect", (req, resp) => {
  if (
    typeof req.query.access_token === "undefined" ||
    typeof req.query.username === "undefined"
  ) {
    req.session.access_token = null;
    req.session.username = null;
    if (typeof req.query.error != "undefined") {
      req.session.error = req.query.error;
      req.session.error_description = req.query.error_description;
    }
  } else {
    console.log("Setting session", req.query.access_token, req.query.username);
    console.log(process.env);
    req.session.access_token = req.query.access_token;
    req.session.username = req.query.username;
  }
  resp.redirect("/login");
});

app.get("/logout", (req, resp) => {
  req.session.access_token = null;
  req.session.username = null;
  resp.redirect("/");
});

app.get("/getusergoals", (req, resp) => {
  setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.status(401).json({error: "Not authenticated"});
    return;
  }
  beemGetUser(
    {
      username: req.session.username,
      access_token: req.session.access_token,
    },
    (goals) => {
      resp.send(JSON.stringify(goals));
    },
    (error) => {
      console.log(error);
    }
  );
});
app.get("/getgoaljson/:goal", (req, resp) => {
  setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
  }
  //console.log("user: "+req.session.username+" "+req.session.access_token)
  beemGetGraphParams(
    {
      username: req.session.username,
      goalslug: req.params.goal,
      access_token: req.session.access_token,
    },
    (goals) => {
      resp.send(JSON.stringify(goals));
    },
    (error) => {
      console.log(error);
    }
  );
});

app.post("/submitroad/:goal", (req, resp) => {
  setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
  }
  beemSubmitRoad(
    {
      usr: req.session.username,
      gol: req.params.goal,
      access_token: req.session.access_token,
      roadall: JSON.stringify(req.body.road),
    },
    function (error, response, body) {
      if (error) {
        return console.error("submit failed:", error);
      }
      resp.send(body);
      //console.log("success? ")
      //console.log(body)
    }
  );
});

app.post("/data/:goal", (req, resp) => {
  setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
  }
  beemSubmitPoint(
    {
      usr: req.session.username,
      gol: req.params.goal,
      access_token: req.session.access_token,
      daystamp: req.body.daystamp,
      timestamp: req.body.timestamp,
      value: req.body.value,
      comment: req.body.comment,
    },
    function (error, response, body) {
      if (error) {
        return console.error("submit point failed:", error);
      }
      resp.send(body);
    }
  );
});

app.delete("/data/:goal/:id", (req, resp) => {
  setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
  }
  beemDeletePoint(
    {
      usr: req.session.username,
      gol: req.params.goal,
      access_token: req.session.access_token,
      id: req.params.id,
    },
    function (error, response, body) {
      if (error) {
        return console.error("delete point failed:", error);
      }
      resp.send(body);
    }
  );
});

app.put("/data/:goal/:id", (req, resp) => {
  setsession(req);
  if (!req.session.access_token || !req.session.username) {
    resp.redirect("/login");
  }
  beemUpdatePoint(
    {
      usr: req.session.username,
      gol: req.params.goal,
      access_token: req.session.access_token,
      id: req.params.id,
      timestamp: req.body.timestamp,
      value: req.body.value,
      comment: req.body.comment,
    },
    function (error, response, body) {
      if (error) {
        return console.error("delete point failed:", error);
      }
      resp.send(body);
    }
  );
});

// helper functions
function beemSubmitRoad(params, callback) {
  var options = {
    url:
      "https://www.beeminder.com/api/v1/users/" +
      params.usr +
      "/goals/" +
      params.gol +
      ".json",
    method: "PUT",
    json: true,
    body: {
      access_token: params.access_token,
      roadall: params.roadall,
    },
  };
  request.put(options, callback);
}

function beemSubmitPoint(params, callback) {
  let r = Math.random().toString(36).substring(7);
  var options = {
    url:
      "https://www.beeminder.com/api/v1/users/" +
      params.usr +
      "/goals/" +
      params.gol +
      "/datapoints.json",
    method: "POST",
    json: true,
    form: {
      access_token: params.access_token,
      daystamp: params.daystamp,
      comment: params.comment,
      value: params.value,
      requestid: r,
    },
  };
  request.post(options, callback);
}

function beemDeletePoint(params, callback) {
  var options = {
    url:
      "https://www.beeminder.com/api/v1/users/" +
      params.usr +
      "/goals/" +
      params.gol +
      "/datapoints/" +
      params.id +
      ".json",
    method: "DELETE",
    json: true,
    form: {
      access_token: params.access_token,
    },
  };
  request.delete(options, callback);
}

function beemUpdatePoint(params, callback) {
  var options = {
    url:
      "https://www.beeminder.com/api/v1/users/" +
      params.usr +
      "/goals/" +
      params.gol +
      "/datapoints/" +
      params.id +
      ".json",
    method: "PUT",
    json: true,
    form: {
      access_token: params.access_token,
      timestamp: params.timestamp,
      comment: params.comment,
      value: params.value,
    },
  };
  request.put(options, callback);
}

function beemGetUser(user, callback, error_callback = () => {}) {
  var options = {
    host: "www.beeminder.com",
    port: 443,
    path:
      "/api/v1/users/" +
      user.username +
      ".json?access_token=" +
      user.access_token,
    method: "GET",
  };
  var req = https.request(options, (res) => {
    var data = "";
    res
      .on("data", (chunk) => {
        data = data + chunk;
      })
      .on("end", () => {
        var userd = JSON.parse(data);
        if (userd) {
          //???? what's an error look like here?
          callback(userd.goals);
        } else {
          error_callback(data);
        }
      });
  });
  req.on("error", (e) => {
    console.log("problem with request: " + e.message);
    error_callback(e.message);
  });
  req.write("");
  req.end();
}

function beemGetGraphParams(usergoal, callback, error_callback = () => {}) {
  var options = {
    host: "www.beeminder.com",
    port: 443,
    path:
      "/api/vx/users/" +
      usergoal.username +
      "/goals/" +
      usergoal.goalslug +
      "/graph.json?access_token=" +
      usergoal.access_token,
    method: "GET",
  };
  var req = https.request(options, (res) => {
    var data = "";
    res
      .on("data", (chunk) => {
        data = data + chunk;
      })
      .on("end", () => {
        var goald = JSON.parse(data);
        if (goald) {
          //???? what's an error look like here?
          callback(goald);
        } else {
          error_callback(data);
        }
      });
  });
  req.on("error", (e) => {
    console.log("problem with request: " + e.message);
    error_callback(e.message);
  });
  req.write("");
  req.end();
}
