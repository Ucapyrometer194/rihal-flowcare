const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ServiceType = sequelize.define('ServiceType', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  durationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  price: {
    // OMR uses 3 decimal places
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0,
  },
  branchId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'service_types',
  timestamps: true,
});

module.exports = ServiceType;
