const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'lending_app_db',
  password: '@Password1', // <-- Make sure this is correct
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
