const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'campaign_reviewed', 'campaign_rework',
  'vendor_allocated', 'survey_completed',
  'creatives_ready', 'work_order_issued',
  'installation_completed', 'installation_report_sent',
  'installation_verified', 'installation_disputed',
  'invoice_received', 'invoice_accepted', 'invoice_rejected',
  'work_order_closed',
];

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceModel: { type: String, default: '' },
  read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
