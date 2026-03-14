const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Staff = sequelize.define('Staff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: process.env.NODE_ENV === 'test' ? DataTypes.STRING : DataTypes.ENUM('admin', 'manager', 'staff'),
    allowNull: false,
    defaultValue: 'staff',
  },
  branchId: {
    type: DataTypes.UUID,
    allowNull: true, // admin doesn't belong to a specific branch
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'staff',
  timestamps: true,
});

module.exports = Staff;
