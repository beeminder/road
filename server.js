// -------------------------------- (80chars) --------------------------------->

var express = require('express')
var app = express()

app.use(express.static('public'))
app.use('/data', express.static('data'))

var listener = app.listen(process.env.PORT, () => {
  console.log(`Road Editor app is running on port ${listener.address().port}`)
})
