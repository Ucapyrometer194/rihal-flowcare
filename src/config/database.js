const { Sequelize } = require('sequelize');
const config = require('./config');

let sequelize;

if (process.env.NODE_ENV === 'test') {
  // use SQLite in-memory for tests — zero external dependencies
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  });
} else {
  sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'postgres',
    logging: false, // set to console.log for debugging
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
}

module.exports = sequelize;
