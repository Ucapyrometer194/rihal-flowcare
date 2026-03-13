const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  slotId: {
    type: DataTypes.UUID,
    allowNull: false,
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
  status: {
    type: DataTypes.ENUM('booked', 'checked-in', 'no-show', 'completed', 'cancelled'),
    defaultValue: 'booked',
  },
  notes: {
    type: DataTypes.TEXT,
  },
  attachment: {
    type: DataTypes.STRING, // optional file upload
  },
  // TODO: add email notifications later
}, {
  tableName: 'appointments',
  timestamps: true,
});

module.exports = Appointment;
