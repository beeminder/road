
const fs = require('fs')

const bu = require('../pub/butil.js')
const br = require('../pub/broad.js')
const bb = require('../pub/beebrain.js')

var bbin = fs.readFileSync('../data/testroad0.bb', 'utf8');
var bbjson = JSON.parse(bbin)

var bbr = new bb(bbjson)
console.log(bbr.getStats())
