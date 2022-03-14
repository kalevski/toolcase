const path = require('path')
const express = require('express')

let app = express()

app.use('/', express.static(path.join(process.cwd(), './public')))

app.get('*', (request, response) => {
    response.sendFile(path.join(process.cwd(), './public/index.html'))
})

app.listen(3000, '0.0.0.0')