const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Slot = sequelize.define('Slot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  branchId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  serviceTypeId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  staffId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  isBooked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // soft delete fields
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'slots',
  timestamps: true,
  // we handle soft deletes manually so we can do retention cleanup
  paranoid: false,
});

module.exports = Slot;
