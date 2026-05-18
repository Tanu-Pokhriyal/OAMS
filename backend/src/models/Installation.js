const mongoose = require('mongoose');

const installImageSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  creativeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Creative' },
  description: { type: String, default: '' },
}, { _id: true });

const installationSchema = new mongoose.Schema({
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  images: [installImageSchema],
  reportPdfUrl: { type: String, default: '' },
  status: { type: String, enum: ['in_progress', 'completed', 'disputed', 'verified'], default: 'in_progress' },
  clientRemarks: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Installation', installationSchema);
