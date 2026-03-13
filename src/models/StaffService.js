const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// junction table for staff <-> service type assignments
const StaffService = sequelize.define('StaffService', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  staffId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  serviceTypeId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'staff_services',
  timestamps: true,
});

module.exports = StaffService;
