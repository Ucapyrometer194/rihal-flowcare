const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  actorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  actorRole: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  targetType: {
    type: DataTypes.STRING, // 'appointment', 'slot', 'staff_assignment', etc
    allowNull: false,
  },
  targetId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  branchId: {
    type: DataTypes.UUID,
    allowNull: true, // for branch-scoped filtering
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false, // logs are immutable
});

module.exports = AuditLog;
