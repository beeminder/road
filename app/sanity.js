
const fs = require('fs')

const bu = require('../src/js/butil.js')
const br = require('../src/js/broad.js')
const bb = require('../src/js/beebrain.js')

var bbin = fs.readFileSync('data/testroad0.bb', 'utf8');
var bbjson = JSON.parse(bbin)

var bbr = new bb(bbjson)
console.log(bbr.getStats())
