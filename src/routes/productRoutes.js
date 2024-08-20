const express = require('express')
const router = express.Router()
const productController = require('../controllers/productController')
const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadPath = path.join(__dirname, '../photos')
		cb(null, uploadPath)
	},
	filename: (req, file, cb) => {
		cb(null, Date.now() + path.extname(file.originalname))
	},
})

const upload = multer({ storage: storage })

router.get('/', productController.getAllProduct)

router.post('/', upload.any(), productController.createNewProduct)

router.delete('/:productId', productController.deleteOneProduct)

router.post('/login', productController.authenticateUser)

module.exports = router
