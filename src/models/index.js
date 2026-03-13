const sequelize = require('../config/database');
const Branch = require('./Branch');
const ServiceType = require('./ServiceType');
const Staff = require('./Staff');
const Customer = require('./Customer');
const Slot = require('./Slot');
const Appointment = require('./Appointment');
const AuditLog = require('./AuditLog');
const StaffService = require('./StaffService');

// Branch has many services
Branch.hasMany(ServiceType, { foreignKey: 'branchId', as: 'services' });
ServiceType.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// Branch has many staff
Branch.hasMany(Staff, { foreignKey: 'branchId', as: 'staff' });
Staff.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// Branch has many slots
Branch.hasMany(Slot, { foreignKey: 'branchId', as: 'slots' });
Slot.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// Service type has many slots
ServiceType.hasMany(Slot, { foreignKey: 'serviceTypeId', as: 'slots' });
Slot.belongsTo(ServiceType, { foreignKey: 'serviceTypeId', as: 'serviceType' });

// Staff can be assigned to slots
Staff.hasMany(Slot, { foreignKey: 'staffId', as: 'slots' });
Slot.belongsTo(Staff, { foreignKey: 'staffId', as: 'staff' });

// Appointments
Customer.hasMany(Appointment, { foreignKey: 'customerId', as: 'appointments' });
Appointment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Slot.hasOne(Appointment, { foreignKey: 'slotId', as: 'appointment' });
Appointment.belongsTo(Slot, { foreignKey: 'slotId', as: 'slot' });

Branch.hasMany(Appointment, { foreignKey: 'branchId', as: 'appointments' });
Appointment.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

ServiceType.hasMany(Appointment, { foreignKey: 'serviceTypeId', as: 'appointments' });
Appointment.belongsTo(ServiceType, { foreignKey: 'serviceTypeId', as: 'serviceType' });

Staff.hasMany(Appointment, { foreignKey: 'staffId', as: 'appointments' });
Appointment.belongsTo(Staff, { foreignKey: 'staffId', as: 'assignedStaff' });

// Staff <-> ServiceType many-to-many through StaffService
Staff.belongsToMany(ServiceType, { through: StaffService, foreignKey: 'staffId', as: 'serviceTypes' });
ServiceType.belongsToMany(Staff, { through: StaffService, foreignKey: 'serviceTypeId', as: 'assignedStaff' });

module.exports = {
  sequelize,
  Branch,
  ServiceType,
  Staff,
  Customer,
  Slot,
  Appointment,
  AuditLog,
  StaffService,
};
