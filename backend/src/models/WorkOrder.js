const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creativeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Creative' }],
  status: { type: String, enum: ['issued', 'in_progress', 'completed', 'closed'], default: 'issued' },
  pdfUrl: { type: String, default: '' },
  issuedDate: { type: Date, default: Date.now },
  closedDate: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
