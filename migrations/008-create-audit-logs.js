'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      actorId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      actorRole: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      targetType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      targetId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      branchId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('audit_logs');
  },
};
