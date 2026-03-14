const { Slot, Appointment } = require('../models');
const { Op } = require('sequelize');
const { logAudit } = require('../middleware/audit');
const config = require('../config/config');

// hard-delete soft-deleted slots that passed the retention period
// cascades to related appointments as required by the challenge spec
async function cleanupExpiredSlots(actorId) {
  const retentionDays = config.softDeleteRetentionDays;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expired = await Slot.findAll({
    where: {
      deletedAt: {
        [Op.ne]: null,
        [Op.lt]: cutoff,
      },
    },
  });

  if (expired.length === 0) {
    return { deleted: 0, appointments: 0, message: 'No expired records to clean up' };
  }

  const ids = expired.map(s => s.id);

  // delete related appointments first (cascade)
  const deletedAppointments = await Appointment.destroy({
    where: { slotId: { [Op.in]: ids } },
  });

  // then hard-delete the slots
  await Slot.destroy({
    where: { id: { [Op.in]: ids } },
  });

  // log the hard delete (audit logs are never deleted)
  for (const slot of expired) {
    await logAudit({
      action: 'slot_hard_deleted',
      actorId: actorId || 'system',
      actorRole: actorId ? 'admin' : 'system',
      targetType: 'slot',
      targetId: slot.id,
      branchId: slot.branchId,
      metadata: {
        deletedAt: slot.deletedAt,
        date: slot.date,
        cascadedAppointments: deletedAppointments,
      },
    });
  }

  return {
    deleted: ids.length,
    appointments: deletedAppointments,
    message: `Removed ${ids.length} expired slot(s) and ${deletedAppointments} related appointment(s)`,
  };
}

module.exports = { cleanupExpiredSlots };
