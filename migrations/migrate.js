/**
 * Simple migration runner for FlowCare
 * Runs all migration files in order (001-xxx, 002-xxx, etc.)
 *
 * Usage:
 *   node migrations/migrate.js          # Run all migrations (up)
 *   node migrations/migrate.js down     # Rollback all migrations (down)
 */

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME || 'flowcare',
  process.env.DB_USER || 'flowcare',
  process.env.DB_PASSWORD || 'flowcare123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
  }
);

async function run() {
  const direction = process.argv[2] || 'up';

  try {
    await sequelize.authenticate();
    console.log('Connected to database.\n');

    // Get all migration files sorted
    const migrationFiles = fs
      .readdirSync(__dirname)
      .filter((f) => f.match(/^\d{3}-.*\.js$/) && f !== 'migrate.js')
      .sort();

    if (direction === 'down') {
      migrationFiles.reverse();
    }

    const queryInterface = sequelize.getQueryInterface();

    for (const file of migrationFiles) {
      const migration = require(path.join(__dirname, file));
      console.log(`${direction === 'up' ? '▶' : '◀'} ${file}...`);
      await migration[direction](queryInterface, Sequelize);
      console.log(`  ✓ Done\n`);
    }

    console.log(`All migrations ${direction === 'up' ? 'applied' : 'rolled back'} successfully.`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
