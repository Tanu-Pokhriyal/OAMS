const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

const CAMPAIGN_CATEGORIES = [
  'Billboard Advertising',
  'Transit Advertising',
  'Retail Branding',
  'Digital OOH (DOOH)',
  'Mall & Multiplex Advertising',
  'Event / Road Shows',
  'Others',
];

const CAMPAIGN_STATUSES = [
  'awaiting_documents', 'pending_approval', 'approved', 'rejected', 'rework_required',
  'vendor_allocated', 'survey_in_progress', 'survey_completed',
  'creatives_in_progress', 'creatives_ready',
  'work_order_issued', 'installation_in_progress', 'installation_completed',
  'client_verified', 'client_disputed',
  'invoiced', 'invoice_accepted', 'invoice_rejected', 'closed',
];

const campaignSchema = new mongoose.Schema({
  campaignId: { type: String, unique: true },
  title: { type: String, required: true, trim: true },
  brief: { type: String, required: true },
  category: { type: String, enum: CAMPAIGN_CATEGORIES, required: true },
  categoryOther: { type: String, default: '', trim: true },
  budget: { type: Number, required: true, min: 0 },
  preferredLocations: [{
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
  }],
  targetLocations: [{ type: String, trim: true }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: CAMPAIGN_STATUSES, default: 'awaiting_documents' },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adminRemarks: { type: String, default: '' },
  additionalDocUrl: { type: String, default: '' },
}, { timestamps: true });

campaignSchema.pre('save', async function () {
  if (!this.campaignId) {
    const counter = await Counter.findByIdAndUpdate(
      'campaignId',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.campaignId = `CAMP-${String(counter.seq).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Campaign', campaignSchema);
module.exports.CAMPAIGN_STATUSES = CAMPAIGN_STATUSES;
module.exports.CAMPAIGN_CATEGORIES = CAMPAIGN_CATEGORIES;
