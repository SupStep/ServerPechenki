const { Pool } = require('pg')

const pool = new Pool({
	user: 'gen_user',
	host: '147.45.236.124',
	database: 'default_db',
	password: 'uPge|51z=T.iT>',
	port: 5432,
})

module.exports = pool
