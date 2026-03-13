const { Appointment, Slot, Branch, ServiceType, Staff, Customer } = require('../models');
const { Op } = require('sequelize');
const { logAudit } = require('../middleware/audit');

async function bookAppointment({ customerId, slotId, notes, attachment }) {
  const slot = await Slot.findOne({ where: { id: slotId, deletedAt: null } });
  if (!slot) {
    throw Object.assign(new Error('Slot not found'), { status: 404 });
  }
  if (slot.isBooked) {
    throw Object.assign(new Error('This slot is already booked'), { status: 409 });
  }

  // rate limiting: max 3 bookings per hour per customer
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentBookings = await Appointment.count({
    where: {
      customerId,
      createdAt: { [Op.gte]: oneHourAgo },
      status: { [Op.ne]: 'cancelled' },
    },
  });

  if (recentBookings >= 3) {
    throw Object.assign(new Error('Booking limit reached. Max 3 per hour.'), { status: 429 });
  }

  const appointment = await Appointment.create({
    customerId,
    slotId: slot.id,
    branchId: slot.branchId,
    serviceTypeId: slot.serviceTypeId,
    staffId: slot.staffId,
    notes,
    attachment: attachment || null,
  });

  // mark slot as taken
  await slot.update({ isBooked: true });

  await logAudit({
    action: 'appointment_created',
    actorId: customerId,
    actorRole: 'customer',
    targetType: 'appointment',
    targetId: appointment.id,
    branchId: slot.branchId,
    metadata: { slotId: slot.id, date: slot.date },
  });

  return appointment;
}

async function listAppointments({ user, page = 1, pageSize = 20, search }) {
  const where = {};

  // scope based on role
  if (user.role === 'customer') {
    where.customerId = user.id;
  } else if (user.role === 'staff') {
    where.staffId = user.id;
  } else if (user.role === 'manager') {
    where.branchId = user.branchId;
  }
  // admin sees everything

  if (search) {
    where[Op.or] = [
      { status: { [Op.iLike]: `%${search}%` } },
      { notes: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * pageSize;
  const { rows, count } = await Appointment.findAndCountAll({
    where,
    include: [
      { model: Slot, as: 'slot', attributes: ['date', 'startTime', 'endTime'] },
      { model: Branch, as: 'branch', attributes: ['name'] },
      { model: ServiceType, as: 'serviceType', attributes: ['name'] },
      { model: Staff, as: 'assignedStaff', attributes: ['name'] },
      { model: Customer, as: 'customer', attributes: ['name', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset,
  });

  return {
    results: rows,
    total: count,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  };
}

async function getAppointment(id, user) {
  const appointment = await Appointment.findByPk(id, {
    include: [
      { model: Slot, as: 'slot' },
      { model: Branch, as: 'branch', attributes: ['name', 'location'] },
      { model: ServiceType, as: 'serviceType', attributes: ['name', 'durationMinutes', 'price'] },
      { model: Staff, as: 'assignedStaff', attributes: ['name'] },
      { model: Customer, as: 'customer', attributes: ['name', 'email', 'phone'] },
    ],
  });

  if (!appointment) {
    throw Object.assign(new Error('Appointment not found'), { status: 404 });
  }

  // customers can only see their own
  if (user.role === 'customer' && appointment.customerId !== user.id) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  // staff can only see their own appointments
  if (user.role === 'staff' && appointment.staffId !== user.id) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  // managers can only see their branch
  if (user.role === 'manager' && appointment.branchId !== user.branchId) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  return appointment;
}

async function cancelAppointment(id, user) {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw Object.assign(new Error('Appointment not found'), { status: 404 });
  }

  // only customers can cancel their own, or admin
  if (user.role === 'customer' && appointment.customerId !== user.id) {
    throw Object.assign(new Error('You can only cancel your own appointments'), { status: 403 });
  }

  if (appointment.status === 'cancelled') {
    throw Object.assign(new Error('Already cancelled'), { status: 400 });
  }

  await appointment.update({ status: 'cancelled' });

  // free up the slot
  await Slot.update({ isBooked: false }, { where: { id: appointment.slotId } });

  await logAudit({
    action: 'appointment_cancelled',
    actorId: user.id,
    actorRole: user.role,
    targetType: 'appointment',
    targetId: appointment.id,
    branchId: appointment.branchId,
  });

  return { message: 'Appointment cancelled' };
}

async function rescheduleAppointment(id, { slotId }, user) {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw Object.assign(new Error('Appointment not found'), { status: 404 });
  }

  if (user.role === 'customer' && appointment.customerId !== user.id) {
    throw Object.assign(new Error('You can only reschedule your own appointments'), { status: 403 });
  }

  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    throw Object.assign(new Error('Cannot reschedule a cancelled or completed appointment'), { status: 400 });
  }

  // check new slot
  const newSlot = await Slot.findOne({ where: { id: slotId, deletedAt: null } });
  if (!newSlot) {
    throw Object.assign(new Error('New slot not found'), { status: 404 });
  }
  if (newSlot.isBooked) {
    throw Object.assign(new Error('New slot is already booked'), { status: 409 });
  }

  const oldSlotId = appointment.slotId;

  // free old slot
  await Slot.update({ isBooked: false }, { where: { id: oldSlotId } });

  // book new slot
  await newSlot.update({ isBooked: true });

  await appointment.update({
    slotId: newSlot.id,
    branchId: newSlot.branchId,
    serviceTypeId: newSlot.serviceTypeId,
    staffId: newSlot.staffId,
  });

  await logAudit({
    action: 'appointment_rescheduled',
    actorId: user.id,
    actorRole: user.role,
    targetType: 'appointment',
    targetId: appointment.id,
    branchId: newSlot.branchId,
    metadata: { oldSlotId, newSlotId: slotId },
  });

  return appointment;
}

async function updateStatus(id, { status, notes }, user) {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw Object.assign(new Error('Appointment not found'), { status: 404 });
  }

  // staff can only update their assigned appointments
  if (user.role === 'staff' && appointment.staffId !== user.id) {
    throw Object.assign(new Error('Not your appointment'), { status: 403 });
  }

  // managers are scoped to their branch
  if (user.role === 'manager' && appointment.branchId !== user.branchId) {
    throw Object.assign(new Error('Not in your branch'), { status: 403 });
  }

  const validStatuses = ['checked-in', 'no-show', 'completed'];
  if (!validStatuses.includes(status)) {
    throw Object.assign(new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`), { status: 400 });
  }

  const updateData = { status };
  if (notes !== undefined) {
    updateData.notes = notes;
  }

  await appointment.update(updateData);

  await logAudit({
    action: 'appointment_status_updated',
    actorId: user.id,
    actorRole: user.role,
    targetType: 'appointment',
    targetId: appointment.id,
    branchId: appointment.branchId,
    metadata: { newStatus: status },
  });

  return appointment;
}

module.exports = {
  bookAppointment,
  listAppointments,
  getAppointment,
  cancelAppointment,
  rescheduleAppointment,
  updateStatus,
};
