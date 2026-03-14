const { setupTestDB, teardownTestDB, seedTestData } = require('../setup');
const { cleanupExpiredSlots } = require('../../src/services/cleanupService');
const { getAuditLogs, exportAuditCSV } = require('../../src/services/auditService');
const { Slot, Appointment, AuditLog, Branch, ServiceType, Staff, Customer, StaffService } = require('../../src/models');

let testData;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await AuditLog.destroy({ where: {} });
  await Appointment.destroy({ where: {}, force: true });
  await Slot.destroy({ where: {} });
  await StaffService.destroy({ where: {} });
  await Staff.destroy({ where: {} });
  await Customer.destroy({ where: {} });
  await ServiceType.destroy({ where: {} });
  await Branch.destroy({ where: {} });
  testData = await seedTestData();
});

describe('CleanupService', () => {
  test('should return zero when no expired slots exist', async () => {
    const result = await cleanupExpiredSlots();
    expect(result.deleted).toBe(0);
    expect(result.appointments).toBe(0);
  });

  test('should hard-delete slots past retention period', async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 31);
    await testData.slot1.update({ deletedAt: cutoffDate });

    const result = await cleanupExpiredSlots('test-admin');
    expect(result.deleted).toBe(1);

    const slot = await Slot.findByPk(testData.slot1.id);
    expect(slot).toBeNull();
  });

  test('should cascade delete related appointments', async () => {
    const appointment = await Appointment.create({
      customerId: testData.customer.id,
      slotId: testData.slot1.id,
      branchId: testData.branch.id,
      serviceTypeId: testData.service.id,
      staffId: testData.staffMember.id,
    });

    await testData.slot1.update({ isBooked: true });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 31);
    await testData.slot1.update({ deletedAt: cutoffDate });

    const result = await cleanupExpiredSlots('test-admin');
    expect(result.deleted).toBe(1);
    expect(result.appointments).toBe(1);

    const found = await Appointment.findByPk(appointment.id);
    expect(found).toBeNull();
  });

  test('should NOT delete recently soft-deleted slots', async () => {
    await testData.slot1.update({ deletedAt: new Date() });

    const result = await cleanupExpiredSlots();
    expect(result.deleted).toBe(0);

    const slot = await Slot.findByPk(testData.slot1.id);
    expect(slot).not.toBeNull();
  });
});

describe('AuditService', () => {
  test('should return paginated audit logs', async () => {
    await AuditLog.create({
      action: 'test_action',
      actorId: testData.admin.id,
      actorRole: 'admin',
      targetType: 'slot',
      targetId: testData.slot1.id,
      branchId: testData.branch.id,
    });

    const result = await getAuditLogs({
      user: { role: 'admin' },
      page: 1,
      pageSize: 10,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  test('should export CSV with correct headers', async () => {
    await AuditLog.create({
      action: 'csv_test',
      actorId: testData.admin.id,
      actorRole: 'admin',
      targetType: 'slot',
      targetId: testData.slot1.id,
    });

    const csv = await exportAuditCSV();
    expect(csv).toContain('id,action,actorId,actorRole,targetType,targetId,branchId,metadata,createdAt');
    expect(csv).toContain('csv_test');
  });

  test('manager should only see their branch logs', async () => {
    await AuditLog.create({
      action: 'branch_log',
      actorId: testData.manager.id,
      actorRole: 'manager',
      targetType: 'slot',
      targetId: testData.slot1.id,
      branchId: testData.branch.id,
    });

    const result = await getAuditLogs({
      user: { role: 'manager', branchId: testData.branch.id },
      page: 1,
      pageSize: 10,
    });

    result.results.forEach(log => {
      expect(log.branchId).toBe(testData.branch.id);
    });
  });
});
