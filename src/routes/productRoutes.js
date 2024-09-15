const express = require('express')
const router = express.Router()
const productController = require('../controllers/productController')
const multer = require('multer')
const path = require('path')
const sharp = require('sharp')
const fs = require('fs')

const storage = multer.memoryStorage()

const upload = multer({ storage: storage })

router.get('/', productController.getAllProduct)

router.post(
	'/',
	upload.any(), // Мы будем обрабатывать любые файлы
	async (req, res, next) => {
		if (req.files && req.files.length > 0) {
			try {
				await Promise.all(
					req.files.map(async file => {
						const filename = Date.now() + path.extname(file.originalname)
						const uploadPath = path.join(__dirname, '../photos', filename)

						await sharp(file.buffer)
							.rotate()
							.resize({ width: 600 })
							.toFormat('jpeg') // Конвертируем в jpeg
							.jpeg({ quality: 90 }) // Устанавливаем качество
							.toFile(uploadPath)

						file.filename = filename
					})
				)
				next()
			} catch (error) {
				console.error('Error processing images:', error)
				return res.status(500).send('Error processing images')
			}
		} else {
			next()
		}
	},
	productController.createNewProduct
)

router.delete('/:productId', productController.deleteOneProduct)

router.post('/login', productController.authenticateUser)

router.put(
	'/:productId',
	upload.any(),
	async (req, res, next) => {
		if (req.files && req.files.length > 0) {
			try {
				await Promise.all(
					req.files.map(async file => {
						const filename = Date.now() + path.extname(file.originalname)
						const uploadPath = path.join(__dirname, '../photos', filename)

						await sharp(file.buffer)
							.rotate()
							.resize({ width: 600 })
							.toFormat('jpeg')
							.jpeg({ quality: 90 })
							.toFile(uploadPath)

						file.filename = filename
					})
				)
				next()
			} catch (error) {
				console.error('Error processing images:', error)
				return res.status(500).send('Error processing images')
			}
		} else {
			next()
		}
	},
	productController.editProduct
)

module.exports = router
