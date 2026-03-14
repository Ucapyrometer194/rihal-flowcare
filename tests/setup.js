const { sequelize } = require('../src/models');
const bcrypt = require('bcryptjs');
const { Branch, ServiceType, Staff, Customer, Slot, Appointment, AuditLog, StaffService } = require('../src/models');

// test database setup - uses same DB but cleans tables before each suite
async function setupTestDB() {
  await sequelize.authenticate();
  await sequelize.sync({ force: true }); // recreate all tables
}

async function teardownTestDB() {
  await sequelize.close();
}

// helper to create test data
async function seedTestData() {
  const branch = await Branch.create({
    name: 'Test Branch',
    location: 'Test Location',
    phone: '+968 1234 5678',
  });

  const service = await ServiceType.create({
    name: 'General Consultation',
    description: 'Standard checkup',
    durationMinutes: 30,
    price: 5.000,
    branchId: branch.id,
  });

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await Staff.create({
    name: 'Test Admin',
    email: 'admin@test.com',
    password: hashedPassword,
    role: 'admin',
    branchId: null,
  });

  const staffPassword = await bcrypt.hash('staff123', 10);
  const manager = await Staff.create({
    name: 'Test Manager',
    email: 'manager@test.com',
    password: staffPassword,
    role: 'manager',
    branchId: branch.id,
  });

  const staffMember = await Staff.create({
    name: 'Test Staff',
    email: 'staff@test.com',
    password: staffPassword,
    role: 'staff',
    branchId: branch.id,
  });

  // assign staff to service
  await StaffService.create({
    staffId: staffMember.id,
    serviceTypeId: service.id,
  });

  const customerPassword = await bcrypt.hash('pass123', 10);
  const customer = await Customer.create({
    name: 'Test Customer',
    email: 'customer@test.com',
    password: customerPassword,
    phone: '+968 9999 9999',
    idImage: 'uploads/test-id.jpg',
  });

  // create slots for today and tomorrow
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const slot1 = await Slot.create({
    branchId: branch.id,
    serviceTypeId: service.id,
    staffId: staffMember.id,
    date: today,
    startTime: '09:00',
    endTime: '09:30',
  });

  const slot2 = await Slot.create({
    branchId: branch.id,
    serviceTypeId: service.id,
    staffId: staffMember.id,
    date: today,
    startTime: '10:00',
    endTime: '10:30',
  });

  const slot3 = await Slot.create({
    branchId: branch.id,
    serviceTypeId: service.id,
    staffId: staffMember.id,
    date: tomorrow,
    startTime: '09:00',
    endTime: '09:30',
  });

  return { branch, service, admin, manager, staffMember, customer, slot1, slot2, slot3 };
}

// helper to encode Basic Auth
function basicAuth(email, password) {
  return 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
}

module.exports = { setupTestDB, teardownTestDB, seedTestData, basicAuth };
