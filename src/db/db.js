const { Pool } = require('pg')

const client = new Pool({
	user: 'gen_user',
	host: '192.168.0.4',
	database: 'default_db',
	password: 'uPge|51z=T.iT>',
	port: 5432,
})

client.connect()
