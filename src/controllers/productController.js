const pool = require('../db/db')
const bcrypt = require('bcryptjs')
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

		// Получаем все элементы боксов и их фотографии
		const boxItemsResult = await pool.query(`
			SELECT
				bi.id AS item_id,
				bi.id_box AS box_id,
				bi.description AS item_description,
				bip.photo_name AS item_photo
			FROM "boxItem" bi
			LEFT JOIN "boxItemPhotos" bip ON bi.id = bip."id_boxItem"
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
					items: [], // добавляем массив для элементов бокса
				}
			}
			if (row.box_photo) {
				boxes[row.box_id].photos.push(row.box_photo)
			}
		})

		// Обрабатываем элементы боксов и добавляем их в соответствующие боксы
		boxItemsResult.rows.forEach(row => {
			const box = boxes[row.box_id]
			if (box) {
				const existingItem = box.items.find(item => item.id === row.item_id)
				if (existingItem) {
					if (row.item_photo) {
						existingItem.photos.push(row.item_photo)
					}
				} else {
					box.items.push({
						id: row.item_id,
						description: row.item_description,
						photos: row.item_photo ? [row.item_photo] : [],
					})
				}
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
	const {
		type,
		name,
		description,
		composition,
		price,
		section,
		structure,
		boxId, // Используем только если тип 'boxItem'
	} = req.body

	const photos = req.files
		.filter(file => file.fieldname === 'photos')
		.map(file => file.filename)

	try {
		let productId

		if (type === 'product') {
			// Создание нового продукта
			const productResult = await pool.query(
				'INSERT INTO "products" ("name", "description", "composition", "price") VALUES ($1, $2, $3, $4) RETURNING id',
				[name, description, composition, price]
			)
			productId = productResult.rows[0].id

			// Сохраняем фотографии продукта
			if (photos.length > 0) {
				const photoQueries = photos.map(photo =>
					pool.query(
						'INSERT INTO "productPhotos" ("id_product", "photo_name") VALUES ($1, $2)',
						[productId, photo]
					)
				)
				await Promise.all(photoQueries)
			}

			// Обработка секции
			if (section) {
				let sectionId
				const sectionResult = await pool.query(
					'SELECT id FROM "sections" WHERE "name" = $1',
					[section]
				)
				if (sectionResult.rows.length > 0) {
					sectionId = sectionResult.rows[0].id
				} else {
					const newSectionResult = await pool.query(
						'INSERT INTO "sections" ("name") VALUES ($1) RETURNING id',
						[section]
					)
					sectionId = newSectionResult.rows[0].id
				}
				await pool.query(
					'INSERT INTO "productSections" ("id_product", "id_section") VALUES ($1, $2)',
					[productId, sectionId]
				)
			}
		} else if (type === 'recipe') {
			const recipeResult = await pool.query(
				'INSERT INTO "recipes" ("name", "description", "price") VALUES ($1, $2, $3) RETURNING id',
				[name, description, price]
			)
			productId = recipeResult.rows[0].id

			if (photos.length > 0) {
				const photoQueries = photos.map(photo =>
					pool.query(
						'INSERT INTO "recipePhotos" ("id_recipe", "photo_name") VALUES ($1, $2)',
						[productId, photo]
					)
				)
				await Promise.all(photoQueries)
			}
		} else if (type === 'box') {
			// Создание нового бокса
			const boxResult = await pool.query(
				'INSERT INTO "boxes" ("name", "structure", "price") VALUES ($1, $2, $3) RETURNING id',
				[name, structure, price]
			)
			productId = boxResult.rows[0].id

			// Сохраняем фотографии бокса
			if (photos.length > 0) {
				const photoQueries = photos.map(photo =>
					pool.query(
						'INSERT INTO "boxesPhotos" ("id_box", "photo_name") VALUES ($1, $2)',
						[productId, photo]
					)
				)
				await Promise.all(photoQueries)
			}
		} else if (type === 'boxItem') {
			// Создание элемента бокса
			if (!boxId) {
				return res.status(400).send('Box ID is required for box items')
			}

			const boxItemResult = await pool.query(
				'INSERT INTO "boxItem" ("id_box", "description") VALUES ($1, $2) RETURNING id',
				[boxId, description]
			)
			productId = boxItemResult.rows[0].id

			// Сохраняем фотографии элемента бокса
			if (photos.length > 0) {
				const photoQueries = photos.map(photo =>
					pool.query(
						'INSERT INTO "boxItemPhotos" ("id_boxItem", "photo_name") VALUES ($1, $2)',
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

const editProduct = async (req, res) => {
	const { productId } = req.params
	const { type, name, description, composition, price, structure } = req.body

	// Фотографии самого продукта/бокса
	const photos = req.files
		.filter(file => file.fieldname === 'photos')
		.map(file => file.filename)

	// Фотографии элементов бокса
	const itemPhotos = req.files
		.filter(file => file.fieldname.startsWith('items'))
		.reduce((acc, file) => {
			const itemId = file.fieldname.split('[')[1].split(']')[0]
			if (!acc[itemId]) acc[itemId] = []
			acc[itemId].push(file.filename)
			return acc
		}, {})

	try {
		if (type === 'product') {
			// Обновляем продукт
			await pool.query(
				'UPDATE "products" SET name = $1, description = $2, composition = $3, price = $4 WHERE id = $5',
				[name, description, composition, price, productId]
			)
			// Обновляем фотографии продукта
			await updatePhotos('productPhotos', 'id_product', productId, photos)
		} else if (type === 'recipe') {
			// Обновляем рецепт
			await pool.query(
				'UPDATE "recipes" SET name = $1, description = $2, price = $3 WHERE id = $4',
				[name, description, price, productId]
			)
			// Обновляем фотографии рецепта
			await updatePhotos('recipePhotos', 'id_recipe', productId, photos)
		} else if (type === 'box') {
			// Обновляем бокс
			await pool.query(
				'UPDATE "boxes" SET name = $1, structure = $2, price = $3 WHERE id = $4',
				[name, structure, price, productId]
			)

			// Обновляем фотографии бокса
			if (photos.length > 0) {
				await updatePhotos('boxesPhotos', 'id_box', productId, photos)
			}
		} else if (type === 'boxItem') {
			// Обновляем элемент бокса
			if (!productId) {
				return res.status(400).send('Product ID is required for box items')
			}

			// Обновляем описание и фотографии элемента бокса
			await pool.query('UPDATE "boxItem" SET description = $1 WHERE id = $2', [
				description,
				productId,
			])

			if (photos.length > 0) {
				await updatePhotos('boxItemPhotos', 'id_boxItem', productId, photos)
			}
		} else {
			return res.status(400).json({ error: 'Invalid product type' })
		}

		res.status(200).json({ message: 'Product updated successfully' })
	} catch (error) {
		console.error('Error updating product:', error)
		res.status(500).json({ error: 'Internal Server Error' })
	}
}

// Вспомогательная функция для обновления фотографий
const updatePhotos = async (photoTable, foreignKey, id, newPhotos) => {
	// Получаем старые фотографии из базы данных
	const oldPhotosResult = await pool.query(
		`SELECT "photo_name" FROM "${photoTable}" WHERE "${foreignKey}" = $1`,
		[id]
	)
	const oldPhotos = oldPhotosResult.rows.map(row => row.photo_name)

	// Удаляем только те старые фотографии, которые были заменены
	if (newPhotos && newPhotos.length > 0) {
		const photosToDelete = oldPhotos.filter(
			oldPhoto => !newPhotos.includes(oldPhoto)
		)

		for (const photo of photosToDelete) {
			const photoPath = path.join(__dirname, '../photos', photo)

			try {
				// Проверяем, существует ли файл, перед его удалением
				await fs.access(photoPath) // Проверка наличия файла
				await fs.unlink(photoPath) // Удаление файла
				console.log(`File ${photo} deleted successfully`)
			} catch (err) {
				if (err.code === 'ENOENT') {
					console.warn(`File ${photo} not found, skipping deletion`)
				} else {
					console.error(`Error deleting file ${photo}:`, err)
				}
			}
		}

		// Удаляем записи старых фотографий только для тех, которые были заменены
		if (photosToDelete.length > 0) {
			await pool.query(
				`DELETE FROM "${photoTable}" WHERE ${foreignKey} = $1 AND photo_name = ANY($2::text[])`,
				[id, photosToDelete]
			)
		}
	}

	// Добавляем новые фотографии
	if (newPhotos.length > 0) {
		const photoQueries = newPhotos.map(photo =>
			pool.query(
				`INSERT INTO "${photoTable}" (${foreignKey}, photo_name) VALUES ($1, $2)`,
				[id, photo]
			)
		)
		await Promise.all(photoQueries)
	}
}

const deleteOneProduct = async (req, res) => {
	const { productId } = req.params
	const { type } = req.body

	try {
		let photoPaths = []

		if (type === 'product') {
			// Удаление фото и продукта
			const photoResult = await pool.query(
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
			// Удаление фото и рецепта
			const photoResult = await pool.query(
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
			// Удаление фото бокса
			const boxPhotoResult = await pool.query(
				'SELECT photo_name FROM "boxesPhotos" WHERE id_box = $1',
				[productId]
			)
			photoPaths = boxPhotoResult.rows.map(row =>
				path.join(__dirname, '../photos', row.photo_name)
			)
			await pool.query('DELETE FROM "boxesPhotos" WHERE id_box = $1', [
				productId,
			])

			// Получаем id всех элементов бокса для удаления их фотографий
			const itemsResult = await pool.query(
				'SELECT id FROM "boxItem" WHERE id_box = $1',
				[productId]
			)
			const itemIds = itemsResult.rows.map(row => row.id)

			// Удаляем фотографии элементов бокса
			if (itemIds.length > 0) {
				const itemPhotosResult = await pool.query(
					'SELECT photo_name FROM "boxItemPhotos" WHERE "id_boxItem" = ANY($1::int[])',
					[itemIds]
				)
				const itemPhotoPaths = itemPhotosResult.rows.map(row =>
					path.join(__dirname, '../photos', row.photo_name)
				)
				photoPaths.push(...itemPhotoPaths)

				await pool.query(
					'DELETE FROM "boxItemPhotos" WHERE "id_boxItem" = ANY($1::int[])',
					[itemIds]
				)

				// Удаляем элементы бокса
				await pool.query('DELETE FROM "boxItem" WHERE id_box = $1', [productId])
			}

			// Удаляем сам бокс
			await pool.query('DELETE FROM "boxes" WHERE id = $1', [productId])
		} else {
			return res.status(404).send('Product not found')
		}

		// Удаление фотографий из файловой системы
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
	editProduct,
}
