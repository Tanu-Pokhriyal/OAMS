const mongoose = require('mongoose');

const MEDIA_TYPES = ['vinyl', 'one_way', 'sunboard', 'no_lit_board', 'glow_sign_board', 'acrylic_board'];

const surveyImageSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  description: { type: String, default: '' },
  size: { type: String, default: '' },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  locationAddress: { type: String, default: '' },
  mediaType: { type: String, enum: MEDIA_TYPES, required: true },
  selectedByAdmin: { type: Boolean, default: false },
}, { _id: true });

const siteSurveySchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  images: [surveyImageSchema],
  pdfUrl: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('SiteSurvey', siteSurveySchema);
module.exports.MEDIA_TYPES = MEDIA_TYPES;
