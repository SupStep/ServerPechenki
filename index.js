const express = require('express')
const path = require('path')
var cors = require('cors')
const Router = require('./src/routes/productRoutes')

const app = express()

const PORT = process.env.PORT || 3000
app.use(cors())

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api', Router)

const photosDir = path.join(__dirname, 'src/photos')

app.use('/photos', express.static(photosDir))

app.listen(PORT, () => {
	console.log(`app listening on port ${PORT}`)
})
