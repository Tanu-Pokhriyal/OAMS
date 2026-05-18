const SiteSurvey = require('../models/SiteSurvey');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { notify } = require('../socket/notificationHelper');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

exports.create = async (req, res) => {
  try {
    const { campaignId, imagesMeta: imagesMetaRaw } = req.body;
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not assigned to this campaign' });
    }
    if (!['vendor_allocated', 'survey_in_progress'].includes(campaign.status)) {
      return res.status(400).json({ message: 'Campaign not ready for survey' });
    }

    // Handle uploaded files — map them to images array
    let surveyImages = [];
    if (req.files && req.files.length > 0) {
      // images metadata comes as JSON string in body field 'imagesMeta'
      const imagesMeta = typeof imagesMetaRaw === 'string' ? JSON.parse(imagesMetaRaw) : (imagesMetaRaw || []);
      surveyImages = req.files.map((file, i) => ({
        imageUrl: `/uploads/${file.filename}`,
        description: imagesMeta[i]?.description || '',
        size: imagesMeta[i]?.size || '',
        location: {
          lat: parseFloat(imagesMeta[i]?.lat) || 0,
          lng: parseFloat(imagesMeta[i]?.lng) || 0,
        },
        locationAddress: imagesMeta[i]?.locationAddress || '',
        mediaType: imagesMeta[i]?.mediaType || 'vinyl',
      }));
    } else if (imagesMetaRaw && Array.isArray(typeof imagesMetaRaw === 'string' ? JSON.parse(imagesMetaRaw) : imagesMetaRaw)) {
      const parsed = typeof imagesMetaRaw === 'string' ? JSON.parse(imagesMetaRaw) : imagesMetaRaw;
      surveyImages = parsed.map(img => ({
        imageUrl: img.imageUrl || '',
        description: img.description || '',
        size: img.size || '',
        location: { lat: parseFloat(img.lat) || 0, lng: parseFloat(img.lng) || 0 },
        locationAddress: img.locationAddress || '',
        mediaType: img.mediaType || 'vinyl',
      }));
    }

    const survey = await SiteSurvey.create({
      campaignId, vendorId: req.user._id, images: surveyImages, status: 'completed',
    });

    // Generate PDF
    const pdfPath = path.join(__dirname, '..', 'uploads', `survey_${survey._id}.pdf`);
    const populatedCampaign = await Campaign.findById(campaignId)
      .populate('clientId', 'name email').populate('vendorId', 'name email');
    await generateSurveyPDF(survey, populatedCampaign, pdfPath);
    survey.pdfUrl = `/uploads/survey_${survey._id}.pdf`;
    await survey.save();

    campaign.status = 'survey_completed';
    await campaign.save();

    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await notify({
        userId: admin._id,
        title: 'Site Survey Completed',
        message: `Site survey for campaign "${campaign.title}" is complete`,
        type: 'survey_completed',
        referenceId: campaign._id,
        referenceModel: 'Campaign',
      });
    }
    res.status(201).json(survey);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { campaignId } = req.query;
    const filter = {};
    if (campaignId) {
      const campaigns = await Campaign.find({ campaignId: { $regex: campaignId, $options: 'i' } }).select('_id');
      if (campaigns.length > 0) filter.campaignId = { $in: campaigns.map(c => c._id) };
      else return res.json([]);
    }
    const surveys = await SiteSurvey.find(filter)
      .populate({ path: 'campaignId', select: 'title campaignId status' })
      .populate('vendorId', 'name email')
      .sort({ createdAt: -1 });
    res.json(surveys);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getByCampaign = async (req, res) => {
  try {
    const survey = await SiteSurvey.findOne({ campaignId: req.params.campaignId })
      .populate('vendorId', 'name email');
    if (!survey) return res.status(404).json({ message: 'No survey found' });
    res.json(survey);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.selectImages = async (req, res) => {
  try {
    const { selectedImageIds } = req.body;
    const survey = await SiteSurvey.findById(req.params.id);
    if (!survey) return res.status(404).json({ message: 'Survey not found' });

    survey.images.forEach(img => {
      img.selectedByAdmin = selectedImageIds.includes(img._id.toString());
    });
    await survey.save();

    const campaign = await Campaign.findById(survey.campaignId);
    campaign.status = 'creatives_in_progress';
    await campaign.save();

    res.json(survey);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function generateSurveyPDF(survey, campaign, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title
    doc.fontSize(22).text('Site Survey Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown();

    // Section 1: Campaign Details
    doc.fontSize(16).fillColor('#1e3a5f').text('1. Campaign Details');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333333')
      .text(`Title: ${campaign.title}`)
      .text(`Brief: ${campaign.brief}`)
      .text(`Budget: ₹${campaign.budget?.toLocaleString()}`)
      .text(`Start Date: ${new Date(campaign.startDate).toLocaleDateString()}`)
      .text(`End Date: ${new Date(campaign.endDate).toLocaleDateString()}`)
      .text(`Status: ${campaign.status}`)
      .text(`Client: ${campaign.clientId?.name || 'N/A'} (${campaign.clientId?.email || ''})`)
      .text(`Vendor: ${campaign.vendorId?.name || 'N/A'} (${campaign.vendorId?.email || ''})`);
    doc.moveDown();

    // Section 2: Survey Images
    doc.fontSize(16).fillColor('#1e3a5f').text('2. Site Survey Images');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333333')
      .text(`Survey Date: ${new Date(survey.createdAt || Date.now()).toLocaleDateString()}`)
      .text(`Total Images: ${survey.images.length}`);
    doc.moveDown(0.5);

    survey.images.forEach((img, i) => {
      if (doc.y > 500) doc.addPage();
      doc.fontSize(11).fillColor('#1e3a5f').text(`Image ${i + 1}:`);
      doc.fontSize(10).fillColor('#333333')
        .text(`  Description: ${img.description}`)
        .text(`  Size: ${img.size}`)
        .text(`  Media Type: ${img.mediaType?.replace(/_/g, ' ')}`)
        .text(`  Location: ${img.locationAddress || 'N/A'} (${img.location.lat}, ${img.location.lng})`);
      const imagePath = path.join(__dirname, '..', img.imageUrl);
      if (fs.existsSync(imagePath)) {
        try {
          doc.moveDown(0.5);
          doc.image(imagePath, { fit: [400, 300], align: 'center' });
        } catch {
          doc.text(`  [Could not embed image]`);
        }
      }
      doc.moveDown();
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
