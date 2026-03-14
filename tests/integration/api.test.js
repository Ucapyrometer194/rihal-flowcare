const request = require('supertest');
const { app } = require('../../src/app');
const { setupTestDB, teardownTestDB, seedTestData, basicAuth } = require('../setup');
const { Slot, Appointment, AuditLog } = require('../../src/models');

describe('FlowCare API Integration Tests', () => {
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
    const { Branch, ServiceType, Staff, Customer, StaffService } = require('../../src/models');
    await StaffService.destroy({ where: {} });
    await Staff.destroy({ where: {} });
    await Customer.destroy({ where: {} });
    await ServiceType.destroy({ where: {} });
    await Branch.destroy({ where: {} });
    testData = await seedTestData();
  });

  // ─── Health ────────────────────────────────────────────
  describe('GET /health', () => {
    test('should return ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ─── Public Endpoints ─────────────────────────────────
  describe('Public Routes', () => {
    test('GET /api/branches - should list branches', async () => {
      const res = await request(app).get('/api/branches');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Test Branch');
    });

    test('GET /api/branches/:id/services - should list services', async () => {
      const res = await request(app).get(`/api/branches/${testData.branch.id}/services`);
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0].name).toBe('General Consultation');
    });

    test('GET /api/slots/available - should return available slots', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get('/api/slots/available')
        .query({
          branchId: testData.branch.id,
          serviceTypeId: testData.service.id,
          date: today,
        });
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2); // slot1 and slot2
    });

    test('GET /api/slots/available - should require params', async () => {
      const res = await request(app).get('/api/slots/available');
      expect(res.status).toBe(400);
    });
  });

  // ─── Auth ─────────────────────────────────────────────
  describe('Auth Routes', () => {
    test('POST /api/auth/login - should authenticate with Basic Auth', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@test.com');
      expect(res.body.role).toBe('admin');
    });

    test('POST /api/auth/login - should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Authorization', basicAuth('admin@test.com', 'wrong'));
      expect(res.status).toBe(401);
    });

    test('POST /api/auth/login - should reject missing auth header', async () => {
      const res = await request(app).post('/api/auth/login');
      expect(res.status).toBe(401);
    });

    test('POST /api/auth/login - customer can login too', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'));
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('customer');
    });
  });

  // ─── Appointments ─────────────────────────────────────
  describe('Appointment Routes', () => {
    test('POST /api/appointments - customer can book a slot', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id, notes: 'Checkup please' });
      expect(res.status).toBe(201);
      expect(res.body.slotId).toBe(testData.slot1.id);
      expect(res.body.status).toBe('booked');

      // verify slot is marked as booked
      const slot = await Slot.findByPk(testData.slot1.id);
      expect(slot.isBooked).toBe(true);
    });

    test('POST /api/appointments - should reject double booking', async () => {
      // book first
      await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id });

      // try to book same slot again
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id });
      expect(res.status).toBe(409);
    });

    test('POST /api/appointments - staff cannot book', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('staff@test.com', 'staff123'))
        .send({ slotId: testData.slot1.id });
      expect(res.status).toBe(403);
    });

    test('GET /api/appointments - customer sees own appointments', async () => {
      // book first
      await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id });

      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'));
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
    });

    test('DELETE /api/appointments/:id - customer can cancel', async () => {
      // book first
      const bookRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id });

      const res = await request(app)
        .delete(`/api/appointments/${bookRes.body.id}`)
        .set('Authorization', basicAuth('customer@test.com', 'pass123'));
      expect(res.status).toBe(200);

      // slot should be freed
      const slot = await Slot.findByPk(testData.slot1.id);
      expect(slot.isBooked).toBe(false);
    });

    test('PUT /api/appointments/:id - customer can reschedule', async () => {
      // book slot1
      const bookRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id });

      // reschedule to slot2
      const res = await request(app)
        .put(`/api/appointments/${bookRes.body.id}`)
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot2.id });
      expect(res.status).toBe(200);

      // old slot freed, new slot booked
      const oldSlot = await Slot.findByPk(testData.slot1.id);
      expect(oldSlot.isBooked).toBe(false);
      const newSlot = await Slot.findByPk(testData.slot2.id);
      expect(newSlot.isBooked).toBe(true);
    });

    test('PATCH /api/appointments/:id/status - staff can update status', async () => {
      // book first
      const bookRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id });

      // staff updates to checked-in
      const res = await request(app)
        .patch(`/api/appointments/${bookRes.body.id}/status`)
        .set('Authorization', basicAuth('staff@test.com', 'staff123'))
        .send({ status: 'checked-in' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('checked-in');
    });

    test('PATCH /api/appointments/:id/status - invalid status rejected', async () => {
      const bookRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id });

      const res = await request(app)
        .patch(`/api/appointments/${bookRes.body.id}/status`)
        .set('Authorization', basicAuth('staff@test.com', 'staff123'))
        .send({ status: 'invalid-status' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Slots ────────────────────────────────────────────
  describe('Slot Routes', () => {
    test('GET /api/slots - manager sees branch slots', async () => {
      const res = await request(app)
        .get('/api/slots')
        .set('Authorization', basicAuth('manager@test.com', 'staff123'));
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(3);
    });

    test('POST /api/slots - manager can create slots', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const res = await request(app)
        .post('/api/slots')
        .set('Authorization', basicAuth('manager@test.com', 'staff123'))
        .send({
          branchId: testData.branch.id,
          serviceTypeId: testData.service.id,
          staffId: testData.staffMember.id,
          date: tomorrow,
          startTime: '14:00',
          endTime: '14:30',
        });
      expect(res.status).toBe(201);
    });

    test('POST /api/slots - batch creation works', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const res = await request(app)
        .post('/api/slots')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'))
        .send([
          { branchId: testData.branch.id, serviceTypeId: testData.service.id, date: tomorrow, startTime: '15:00', endTime: '15:30' },
          { branchId: testData.branch.id, serviceTypeId: testData.service.id, date: tomorrow, startTime: '16:00', endTime: '16:30' },
        ]);
      expect(res.status).toBe(201);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
    });

    test('DELETE /api/slots/:id - soft delete sets deletedAt', async () => {
      const res = await request(app)
        .delete(`/api/slots/${testData.slot1.id}`)
        .set('Authorization', basicAuth('manager@test.com', 'staff123'));
      expect(res.status).toBe(200);

      const slot = await Slot.findByPk(testData.slot1.id);
      expect(slot.deletedAt).not.toBeNull();
    });

    test('customer cannot access slot management', async () => {
      const res = await request(app)
        .get('/api/slots')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'));
      expect(res.status).toBe(403);
    });
  });

  // ─── Staff ────────────────────────────────────────────
  describe('Staff Routes', () => {
    test('GET /api/staff - admin sees all staff', async () => {
      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(2); // manager + staff (admin filtered out)
    });

    test('POST /api/staff/:id/services - assign staff to services', async () => {
      const res = await request(app)
        .post(`/api/staff/${testData.staffMember.id}/services`)
        .set('Authorization', basicAuth('admin@test.com', 'admin123'))
        .send({ serviceTypeIds: [testData.service.id] });
      expect(res.status).toBe(200);
      expect(res.body.serviceTypes).toBeInstanceOf(Array);
    });

    test('customer cannot access staff routes', async () => {
      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'));
      expect(res.status).toBe(403);
    });
  });

  // ─── Customers ────────────────────────────────────────
  describe('Customer Routes', () => {
    test('GET /api/customers - admin sees all customers', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      // password should be excluded
      expect(res.body.results[0].password).toBeUndefined();
    });

    test('GET /api/customers/:id - admin sees customer detail', async () => {
      const res = await request(app)
        .get(`/api/customers/${testData.customer.id}`)
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Customer');
    });

    test('non-admin cannot access customers', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', basicAuth('manager@test.com', 'staff123'));
      expect(res.status).toBe(403);
    });
  });

  // ─── Audit Logs ───────────────────────────────────────
  describe('Audit Log Routes', () => {
    test('GET /api/audit-logs - admin sees all logs', async () => {
      // create an appointment to generate audit logs
      await request(app)
        .post('/api/appointments')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'))
        .send({ slotId: testData.slot1.id });

      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    test('POST /api/audit-logs/export - CSV export works', async () => {
      const { AuditLog } = require('../../src/models');
      await AuditLog.create({
        action: 'export_test',
        actorId: testData.admin.id,
        actorRole: 'admin',
        targetType: 'test',
        targetId: testData.slot1.id,
      });

      const res = await request(app)
        .post('/api/audit-logs/export')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    test('customer cannot access audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', basicAuth('customer@test.com', 'pass123'));
      expect(res.status).toBe(403);
    });
  });

  // ─── Admin ────────────────────────────────────────────
  describe('Admin Routes', () => {
    test('POST /api/admin/soft-delete-retention - set retention days', async () => {
      const res = await request(app)
        .post('/api/admin/soft-delete-retention')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'))
        .send({ days: 60 });
      expect(res.status).toBe(200);
      expect(res.body.retentionDays).toBe(60);
    });

    test('POST /api/admin/soft-delete-retention - reject invalid days', async () => {
      const res = await request(app)
        .post('/api/admin/soft-delete-retention')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'))
        .send({ days: 0 });
      expect(res.status).toBe(400);
    });

    test('POST /api/admin/cleanup - manual cleanup works', async () => {
      const res = await request(app)
        .post('/api/admin/cleanup')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBeDefined();
    });

    test('non-admin cannot access admin routes', async () => {
      const res = await request(app)
        .post('/api/admin/cleanup')
        .set('Authorization', basicAuth('manager@test.com', 'staff123'));
      expect(res.status).toBe(403);
    });
  });

  // ─── RBAC (Role-Based Access Control) ─────────────────
  describe('RBAC', () => {
    test('admin can access everything', async () => {
      const endpoints = [
        { method: 'get', path: '/api/slots' },
        { method: 'get', path: '/api/staff' },
        { method: 'get', path: '/api/customers' },
        { method: 'get', path: '/api/audit-logs' },
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path)
          .set('Authorization', basicAuth('admin@test.com', 'admin123'));
        expect(res.status).not.toBe(403);
      }
    });

    test('manager scoped to their branch', async () => {
      const res = await request(app)
        .get('/api/slots')
        .set('Authorization', basicAuth('manager@test.com', 'staff123'));
      expect(res.status).toBe(200);
      // all returned slots should be from manager's branch
      res.body.results.forEach(slot => {
        expect(slot.branchId).toBe(testData.branch.id);
      });
    });
  });

  // ─── Soft Delete Lifecycle ────────────────────────────
  describe('Soft Delete Lifecycle', () => {
    test('full lifecycle: create → soft-delete → cleanup', async () => {
      // 1. Create slot
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const createRes = await request(app)
        .post('/api/slots')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'))
        .send({
          branchId: testData.branch.id,
          serviceTypeId: testData.service.id,
          date: tomorrow,
          startTime: '11:00',
          endTime: '11:30',
        });
      expect(createRes.status).toBe(201);
      const slotId = createRes.body.id;

      // 2. Soft-delete
      const deleteRes = await request(app)
        .delete(`/api/slots/${slotId}`)
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(deleteRes.status).toBe(200);

      // 3. Verify still in DB
      const slot = await Slot.findByPk(slotId);
      expect(slot).not.toBeNull();
      expect(slot.deletedAt).not.toBeNull();

      // 4. Reset retention to 30 days and set deletedAt to past retention
      await request(app)
        .post('/api/admin/soft-delete-retention')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'))
        .send({ days: 30 });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 31);
      await slot.update({ deletedAt: pastDate });

      // 5. Run cleanup
      const cleanupRes = await request(app)
        .post('/api/admin/cleanup')
        .set('Authorization', basicAuth('admin@test.com', 'admin123'));
      expect(cleanupRes.status).toBe(200);
      expect(cleanupRes.body.deleted).toBeGreaterThanOrEqual(1);

      // 6. Verify hard-deleted
      const gone = await Slot.findByPk(slotId);
      expect(gone).toBeNull();
    });
  });

  // ─── Swagger ──────────────────────────────────────────
  describe('API Documentation', () => {
    test('GET /api-docs.json - returns OpenAPI spec', async () => {
      const res = await request(app).get('/api-docs.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.0');
      expect(res.body.info.title).toBeDefined();
      expect(res.body.paths).toBeDefined();
    });
  });
});
