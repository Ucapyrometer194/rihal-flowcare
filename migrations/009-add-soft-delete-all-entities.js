// Migration: Add deletedAt (soft-delete) column to all entities
// Previously only slots had soft-delete support. This extends it to
// branches, service_types, staff, customers, and appointments.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = ['branches', 'service_types', 'staff', 'customers', 'appointments'];

    for (const table of tables) {
      // check if column already exists (idempotent)
      const desc = await queryInterface.describeTable(table);
      if (!desc.deletedAt) {
        await queryInterface.addColumn(table, 'deletedAt', {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: null,
        });
      }
    }

    // add indexes for soft-delete queries
    for (const table of tables) {
      await queryInterface.addIndex(table, ['deletedAt'], {
        name: `idx_${table}_deleted_at`,
        where: { deletedAt: null },
      }).catch(() => {}); // ignore if index exists
    }
  },

  down: async (queryInterface) => {
    const tables = ['branches', 'service_types', 'staff', 'customers', 'appointments'];

    for (const table of tables) {
      await queryInterface.removeIndex(table, `idx_${table}_deleted_at`).catch(() => {});
      await queryInterface.removeColumn(table, 'deletedAt').catch(() => {});
    }
  },
};
