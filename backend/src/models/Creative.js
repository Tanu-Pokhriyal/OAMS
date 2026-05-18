const mongoose = require('mongoose');

const creativeSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  surveyImageId: { type: String, required: true },
  creativeImageUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'processed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Creative', creativeSchema);
