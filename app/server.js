"use strict";
// -------------------------------- (80chars) --------------------------------->

require('dotenv').config()

var express = require('express')
var https = require('https')
var http = require('http')
var bodyParser = require('body-parser')
var session = require('express-session')
var Sequelize = require('sequelize')
var request = require('request')

// Setting session store to Sequelize
var SequelizeStore = require('connect-session-sequelize')(session.Store)

// Initializing the app
var app = express()

// Enabling cookies via HTTPS
app.set('trust proxy', 1)
app.set('view engine', 'ejs');

// Enabling JSON request parser
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

// Initiate global model class for user
var User = null

// Setting up a new database using database credentials set in .env
var sequelize = new Sequelize('database', process.env.DB_USER, 
                                          process.env.DB_PASS, {
  host: '0.0.0.0',
  dialect: 'sqlite',
  pool: {
    max: 5,
    min: 0,
    idle: 10000
  },
  // Security note: the database is saved to the file `database.sqlite` in 
  // the local filesystem. It's deliberately placed in the `.data` directory
  // which doesn't get copied if someone remixes the project.
  storage: '.data/database.sqlite'
})

// Setting up session parameters
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: new SequelizeStore({ db: sequelize }),
  saveUninitialized: false,
  resave: false,
  cookie: { secure: true },
  trustProxie: true
}))

// Connecting to the database and defining Models
sequelize.authenticate()
  .then((err) => {
    console.log('Database connection established.')
    User = sequelize.define('users', {           // Defining table 'users'
      username:     { type: Sequelize.STRING },
      access_token: { type: Sequelize.STRING }
    })
    sequelize.sync()              // Creating table User if it does not exist
  })
  .catch((err) => {
    console.log('Unable to connect to the database: ', err)
  })


// Stuff in the pub directory is served statically
app.use(express.static('pub'))
// Serve BB files under the data directory through /data
app.use('/data', express.static('data'))
// Serve JS, CSS and other files under the list directory in /lib
app.use('/lib', express.static('lib'))

var listener = app.listen(process.env.PORT, () => {
  console.log(`Road Editor app is running on port ${listener.address().port}`)
  console.log(`AUTH_REDIRECT_URI is ${process.env.AUTH_REDIRECT_URI}`)
})

app.get("/login", (req, resp) => {
  //console.log("!!!! GOT LOGIN !!!!")
  //console.log(req.session)
  if(typeof req.session.access_token === 'undefined' || 
            req.session.access_token === null) {
    
    resp.render('login.ejs', {
      BEEMINDER_CLIENT_ID: process.env.BEEMINDER_CLIENT_ID, 
      AUTH_REDIRECT_URI:   process.env.AUTH_REDIRECT_URI
    })
  } else {
    resp.redirect('/road')
  }
})
app.get("/road", (req, resp) => {
  if (typeof req.session.access_token === 'undefined' ||
             req.session.access_token === null) {
    resp.redirect('/login')
  } else {
    var user = {
      username: req.session.username,
      access_token: req.session.access_token
    }
    resp.render('road.ejs', {user: user})
  }
})
app.get("/editor", (req, resp) => {
  resp.render('road.ejs', {user: null})
})
app.get("/sandbox", (req, resp) => {
  resp.render('sandbox.ejs', {user: null})
})
app.get("/", (req, resp) => {
  if (typeof req.session.access_token === 'undefined' ||
             req.session.access_token === null) {
    resp.redirect('/login')
  } else {
    var user = {
      username: req.session.username,
      access_token: req.session.access_token
    }
    resp.render('road.ejs', {user: user})
  }
})


// Callback endpoint to receive username and access_token from Beeminder upon 
// successful authorization
app.get("/connect", (req, resp) => {
  console.log("/connect")
  if(typeof req.query.access_token === 'undefined' || 
     typeof req.query.username === 'undefined') {
    req.session.access_token = null
    req.session.username = null
    if(typeof req.query.error != 'undefined') {
      req.session.error = req.query.error
      req.session.error_description = req.query.error_description
    }
  } else {
    req.session.access_token = req.query.access_token
    req.session.username = req.query.username
  }
  resp.redirect('/login')
})

app.get("/logout", (req, resp) => {
  req.session.access_token = null
  req.session.username = null
  resp.redirect('/')
})

app.get("/getusergoals", (req, resp) => {
  if(!req.session.access_token || !req.session.username) {
    resp.redirect('/login')
  }
  beemGetUser({
    username: req.session.username, 
    access_token: req.session.access_token
  }, (goals)=> {
    resp.send(JSON.stringify( goals ))
  }, (error)=> { console.log(error) })
})
app.get("/getgoaljson/:goal", (req, resp) => {
  if(!req.session.access_token || !req.session.username) {
    resp.redirect('/login')
  }
  //console.log("user: "+req.session.username+" "+req.session.access_token)
  beemGetGraphParams({
    username: req.session.username, 
    goalslug: req.params.goal,
    access_token: req.session.access_token
    
  }, (goals)=> {
    resp.send(JSON.stringify( goals ))
  }, (error)=> { console.log(error) })
})

app.post("/submitroad/:goal", (req, resp)=>{
  if(!req.session.access_token || !req.session.username) {
    resp.redirect('/login')
  }
  console.log(req.body)
  beemSubmitRoad({
    usr: req.session.username,
    gol: req.params.goal,
    access_token: req.session.access_token,
    roadall: req.body.road
  }, function(error, response, body) {
    if (error) {
      return console.error('submit failed:', error);
    }
    resp.send(body)
    //console.log("success? ")
    //console.log(body)
  })
})

// helper functions
function beemSubmitRoad(params, callback) {
  console.log("beemSubmitRoad")
  var options = {
    url: 'https://www.beeminder.com/api/v1/users/'+params.usr+'/goals/'+params.gol+'.json',
    method: 'PUT',
    json: true,
    body: {
      access_token: params.access_token,
      roadall: params.roadall
    }
  }
  console.log(options)
  request.put(options, callback)
}

function beemGetUser(user, callback, error_callback = ()=>{}) {
  var options = {
    host: 'www.beeminder.com',
    port: 443,
    path: '/api/v1/users/' + user.username + '.json?access_token=' + user.access_token,
    method: 'GET'
  }
  var req = https.request(options, (res) => {
    var data = ''
    res.on('data', (chunk) => {
      data = data + chunk
    }).on('end', () => {
      var userd = JSON.parse(data)
      if(userd) { //???? what's an error look like here?
        callback(userd.goals)
      } else {
        error_callback(data)
      }
    })
  })
  req.on('error', (e) => {
    console.log('problem with request: ' + e.message)
    error_callback(e.message)
  })
  req.write('')
  req.end()
}

function beemGetGraphParams(usergoal, callback, error_callback = ()=>{}) {
  var options = {
    host: 'www.beeminder.com',
    port: 443,
    path: '/api/vx/users/' + usergoal.username + '/goals/' + usergoal.goalslug + '/graph.json?access_token=' + usergoal.access_token,
    method: 'GET'
  }
  var req = https.request(options, (res) => {
    var data = ''
    res.on('data', (chunk) => {
      data = data + chunk
    }).on('end', () => {
      var goald = JSON.parse(data)
      if(goald) { //???? what's an error look like here?
        callback(goald)
      } else {
        error_callback(data)
      }
    })
  })
  req.on('error', (e) => {
    console.log('problem with request: ' + e.message)
    error_callback(e.message)
  })
  req.write('')
  req.end()
}
