const pool = require('../db/db')
const bcrypt = require('bcrypt')
const fs = require('fs')
const path = require('path')
const saltRounds = 10

// const registerUser = async (req, res) => {
// 	const { name, password } = req.body

// 	if (!name || !password) {
// 		return res.status(400).json({ error: 'Name and password are required' })
// 	}

// 	try {
// 		// Хэшируем пароль
// 		const hashedPassword = await bcrypt.hash(password, saltRounds)

// 		// Сохраняем пользователя в базе данных
// 		const result = await pool.query(
// 			'INSERT INTO users (name, password) VALUES ($1, $2) RETURNING id',
// 			[name, hashedPassword]
// 		)

// 		const userId = result.rows[0].id

// 		res
// 			.status(201)
// 			.json({ id: userId, message: 'User registered successfully' })
// 	} catch (error) {
// 		console.error('Error registering user:', error)
// 		res.status(500).json({ error: 'Internal Server Error' })
// 	}
// }

const authenticateUser = async (req, res) => {
	const { name, password } = req.body

	if (!name || !password) {
		return res.status(400).json({ error: 'Name and password are required' })
	}

	try {
		// Проверяем наличие пользователя в базе данных
		const result = await pool.query('SELECT * FROM users WHERE name = $1', [
			name,
		])
		const user = result.rows[0]

		if (!user) {
			return res.status(401).json({ error: 'Invalid name or password' })
		}

		const match = await bcrypt.compare(password, user.password)

		if (match) {
			res.status(200).json({ message: 'Authentication successful' })
		} else {
			res.status(401).json({ error: 'Invalid name or password' })
		}
	} catch (error) {
		console.error('Error authenticating user:', error)
		res.status(500).json({ error: 'Internal Server Error' })
	}
}

const getAllProduct = async (req, res) => {
	try {
		// Получаем все продукты и их данные
		const productsResult = await pool.query(`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.description AS product_description,
        p.composition AS product_composition,
        p.price AS product_price,
        pp.photo_name AS product_photo,
        s.id AS section_id,
        s.name AS section_name
      FROM products p
      LEFT JOIN "productPhotos" pp ON p.id = pp.id_product
      LEFT JOIN "productSections" ps ON p.id = ps.id_product
      LEFT JOIN "sections" s ON ps.id_section = s.id
    `)

		// Получаем все рецепты и их данные
		const recipesResult = await pool.query(`
      SELECT
        r.id AS recipe_id,
        r.name AS recipe_name,
        r.description AS recipe_description,
        r.price AS recipe_price,
        rp.photo_name AS recipe_photo
      FROM recipes r
      LEFT JOIN "recipePhotos" rp ON r.id = rp.id_recipe
    `)

		// Получаем все боксы и их данные
		const boxesResult = await pool.query(`
      SELECT
        b.id AS box_id,
        b.name AS box_name,
        b.structure AS box_structure,
        b.price AS box_price,
        bp.photo_name AS box_photo
      FROM boxes b
      LEFT JOIN "boxesPhotos" bp ON b.id = bp.id_box
    `)

		// Обрабатываем продукты
		const productsBySections = {}
		productsResult.rows.forEach(row => {
			if (!productsBySections[row.section_id]) {
				productsBySections[row.section_id] = {
					section_name: row.section_name,
					products: [],
				}
			}

			const existingProduct = productsBySections[row.section_id].products.find(
				product => product.id === row.product_id
			)

			if (existingProduct) {
				if (row.product_photo) {
					existingProduct.photos.push(row.product_photo)
				}
			} else {
				productsBySections[row.section_id].products.push({
					id: row.product_id,
					name: row.product_name,
					description: row.product_description,
					composition: row.product_composition,
					price: row.product_price,
					photos: row.product_photo ? [row.product_photo] : [],
				})
			}
		})

		// Обрабатываем рецепты
		const recipes = {}
		recipesResult.rows.forEach(row => {
			if (!recipes[row.recipe_id]) {
				recipes[row.recipe_id] = {
					id: row.recipe_id,
					name: row.recipe_name,
					description: row.recipe_description,
					price: row.recipe_price,
					photos: [],
				}
			}
			if (row.recipe_photo) {
				recipes[row.recipe_id].photos.push(row.recipe_photo)
			}
		})

		// Обрабатываем боксы
		const boxes = {}
		boxesResult.rows.forEach(row => {
			if (!boxes[row.box_id]) {
				boxes[row.box_id] = {
					id: row.box_id,
					name: row.box_name,
					structure: row.box_structure,
					price: row.box_price,
					photos: [],
				}
			}
			if (row.box_photo) {
				boxes[row.box_id].photos.push(row.box_photo)
			}
		})

		res.status(200).json({
			recipes: Object.values(recipes),
			boxes: Object.values(boxes),
			productsBySections: Object.values(productsBySections),
		})
	} catch (error) {
		console.error('Error fetching products:', error)
		res.status(500).json({ error: 'Internal Server Error' })
	}
}

const createNewProduct = async (req, res) => {
	const { type, name, description, composition, price, section, structure } =
		req.body
	const photos = req.files ? req.files.map(file => file.filename) : []

	try {
		let productId

		if (type === 'product') {
			const productResult = await pool.query(
				'INSERT INTO "products" (name, description, composition, price) VALUES ($1, $2, $3, $4) RETURNING id',
				[name, description, composition, price]
			)
			productId = productResult.rows[0].id

			if (photos.length > 0) {
				const photoQueries = photos.map(photo =>
					pool.query(
						'INSERT INTO "productPhotos" (id_product, photo_name) VALUES ($1, $2)',
						[productId, photo]
					)
				)
				await Promise.all(photoQueries)
			}

			if (section) {
				let sectionId
				const sectionResult = await pool.query(
					'SELECT id FROM "sections" WHERE name = $1',
					[section]
				)

				if (sectionResult.rows.length > 0) {
					sectionId = sectionResult.rows[0].id
				} else {
					const newSectionResult = await pool.query(
						'INSERT INTO "sections" (name) VALUES ($1) RETURNING id',
						[section]
					)
					sectionId = newSectionResult.rows[0].id
				}

				await pool.query(
					'INSERT INTO "productSections" (id_product, id_section) VALUES ($1, $2)',
					[productId, sectionId]
				)
			}
		} else if (type === 'recipe') {
			const recipeResult = await pool.query(
				'INSERT INTO "recipes" (name, description, price) VALUES ($1, $2, $3) RETURNING id',
				[name, description, price]
			)
			productId = recipeResult.rows[0].id

			if (photos.length > 0) {
				const photoQueries = photos.map(photo =>
					pool.query(
						'INSERT INTO "recipePhotos" (id_recipe, photo_name) VALUES ($1, $2)',
						[productId, photo]
					)
				)
				await Promise.all(photoQueries)
			}
		} else if (type === 'box') {
			const boxResult = await pool.query(
				'INSERT INTO "boxes" (name, structure, price) VALUES ($1, $2, $3) RETURNING id',
				[name, structure, price]
			)
			productId = boxResult.rows[0].id

			if (photos.length > 0) {
				const photoQueries = photos.map(photo =>
					pool.query(
						'INSERT INTO "boxesPhotos" (id_box, photo_name) VALUES ($1, $2)',
						[productId, photo]
					)
				)
				await Promise.all(photoQueries)
			}
		} else {
			return res.status(400).send('Invalid product type')
		}

		res.status(201).send('Product created')
	} catch (error) {
		console.error('Error creating product:', error)
		res.status(500).send('Server error')
	}
}

const deleteOneProduct = async (req, res) => {
	const { productId } = req.params
	const { type } = req.body

	try {
		let photoPaths = []

		// Определяем тип продукта и получаем связанные фотографии
		let photoResult, deletePhotoQuery, deleteProductQuery

		if (type === 'product') {
			photoResult = await pool.query(
				'SELECT photo_name FROM "productPhotos" WHERE id_product = $1',
				[productId]
			)
			photoPaths = photoResult.rows.map(row =>
				path.join(__dirname, '../photos', row.photo_name)
			)
			await pool.query('DELETE FROM "productPhotos" WHERE id_product = $1', [
				productId,
			])
			await pool.query('DELETE FROM "productSections" WHERE id_product = $1', [
				productId,
			])
			await pool.query('DELETE FROM "products" WHERE id = $1', [productId])
		} else if (type === 'recipe') {
			photoResult = await pool.query(
				'SELECT photo_name FROM "recipePhotos" WHERE id_recipe = $1',
				[productId]
			)
			photoPaths = photoResult.rows.map(row =>
				path.join(__dirname, '../photos', row.photo_name)
			)
			await pool.query('DELETE FROM "recipePhotos" WHERE id_recipe = $1', [
				productId,
			])
			await pool.query('DELETE FROM "recipes" WHERE id = $1', [productId])
		} else if (type === 'box') {
			photoResult = await pool.query(
				'SELECT photo_name FROM "boxesPhotos" WHERE id_box = $1',
				[productId]
			)
			photoPaths = photoResult.rows.map(row =>
				path.join(__dirname, '../photos', row.photo_name)
			)
			await pool.query('DELETE FROM "boxesPhotos" WHERE id_box = $1', [
				productId,
			])
			await pool.query('DELETE FROM "boxes" WHERE id = $1', [productId])
		} else {
			return res.status(404).send('Product not found')
		}

		// Удаляем фотографии из файловой системы
		photoPaths.forEach(photoPath => {
			fs.unlink(photoPath, err => {
				if (err) {
					console.error('Error deleting photo:', photoPath, err)
				}
			})
		})

		res.status(200).send('Product deleted')
	} catch (error) {
		console.error('Error deleting product:', error)
		res.status(500).send('Server error')
	}
}

module.exports = {
	// registerUser,
	authenticateUser,
	getAllProduct,
	createNewProduct,
	deleteOneProduct,
}
