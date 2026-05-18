const WorkOrder = require('../models/WorkOrder');
const Campaign = require('../models/Campaign');
const Creative = require('../models/Creative');
const SiteSurvey = require('../models/SiteSurvey');
const { notify } = require('../socket/notificationHelper');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

exports.create = async (req, res) => {
  try {
    const { campaignId } = req.body;
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'creatives_ready') {
      return res.status(400).json({ message: 'Creatives must be ready before creating work order' });
    }
    const creatives = await Creative.find({ campaignId, status: 'processed' });
    if (creatives.length === 0) {
      return res.status(400).json({ message: 'No processed creatives found' });
    }
    const workOrder = await WorkOrder.create({
      campaignId,
      vendorId: campaign.vendorId,
      creativeIds: creatives.map(c => c._id),
    });

    // Generate cumulative Work Order PDF
    const populatedCampaign = await Campaign.findById(campaignId)
      .populate('clientId', 'name email').populate('vendorId', 'name email');
    const survey = await SiteSurvey.findOne({ campaignId });
    const pdfPath = path.join(__dirname, '..', 'uploads', `workorder_${workOrder._id}.pdf`);
    await generateWorkOrderPDF(workOrder, populatedCampaign, survey, creatives, pdfPath);
    workOrder.pdfUrl = `/uploads/workorder_${workOrder._id}.pdf`;
    await workOrder.save();

    campaign.status = 'work_order_issued';
    await campaign.save();
    await notify({
      userId: campaign.vendorId,
      title: 'New Work Order',
      message: `Work order issued for campaign "${campaign.title}"`,
      type: 'work_order_issued',
      referenceId: workOrder._id,
      referenceModel: 'WorkOrder',
    });
    res.status(201).json(workOrder);
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
    const workOrders = await WorkOrder.find(filter)
      .populate({ path: 'campaignId', select: 'title campaignId status' })
      .populate('vendorId', 'name email')
      .sort({ createdAt: -1 });
    res.json(workOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.id)
      .populate('campaignId', 'title status clientId')
      .populate('vendorId', 'name email')
      .populate('creativeIds');
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getByCampaign = async (req, res) => {
  try {
    const wo = await WorkOrder.findOne({ campaignId: req.params.campaignId })
      .populate('vendorId', 'name email')
      .populate('creativeIds');
    if (!wo) return res.status(404).json({ message: 'No work order found' });
    res.json(wo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.close = async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    const campaign = await Campaign.findById(wo.campaignId);
    if (campaign.status !== 'invoice_accepted') {
      return res.status(400).json({ message: 'Invoice must be accepted before closing' });
    }
    wo.status = 'closed';
    wo.closedDate = new Date();
    await wo.save();
    campaign.status = 'closed';
    await campaign.save();
    await notify({
      userId: wo.vendorId,
      title: 'Work Order Closed',
      message: `Work order for campaign "${campaign.title}" has been closed`,
      type: 'work_order_closed',
      referenceId: wo._id,
      referenceModel: 'WorkOrder',
    });
    res.json(wo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- Helper: embed image safely ---
function embedImage(doc, imageUrl) {
  const imagePath = path.join(__dirname, '..', imageUrl);
  if (fs.existsSync(imagePath)) {
    try {
      doc.moveDown(0.5);
      doc.image(imagePath, { fit: [400, 300], align: 'center' });
    } catch {
      doc.text('  [Could not embed image]');
    }
  }
}

// --- Cumulative Work Order PDF ---
function generateWorkOrderPDF(workOrder, campaign, survey, creatives, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title
    doc.fontSize(22).text('Work Order Report', { align: 'center' });
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
      .text(`Client: ${campaign.clientId?.name || 'N/A'} (${campaign.clientId?.email || ''})`)
      .text(`Vendor: ${campaign.vendorId?.name || 'N/A'} (${campaign.vendorId?.email || ''})`);
    doc.moveDown();

    // Section 2: Site Survey Summary
    if (survey) {
      doc.fontSize(16).fillColor('#1e3a5f').text('2. Site Survey Summary');
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#333333')
        .text(`Survey Date: ${new Date(survey.createdAt || Date.now()).toLocaleDateString()}`)
        .text(`Total Images Surveyed: ${survey.images.length}`)
        .text(`Selected by Admin: ${survey.images.filter(i => i.selectedByAdmin).length}`);
      doc.moveDown(0.5);
      survey.images.filter(i => i.selectedByAdmin).forEach((img, i) => {
        if (doc.y > 500) doc.addPage();
        doc.fontSize(11).fillColor('#1e3a5f').text(`Selected Site ${i + 1}:`);
        doc.fontSize(10).fillColor('#333333')
          .text(`  Description: ${img.description}`)
          .text(`  Size: ${img.size}`)
          .text(`  Media Type: ${img.mediaType?.replace(/_/g, ' ')}`)
          .text(`  Location: ${img.locationAddress || 'N/A'} (${img.location.lat}, ${img.location.lng})`);
        embedImage(doc, img.imageUrl);
        doc.moveDown();
      });
    }

    // Section 3: Creative Designs
    doc.addPage();
    doc.fontSize(16).fillColor('#1e3a5f').text('3. Creative Designs');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333333')
      .text(`Total Creatives: ${creatives.length}`);
    doc.moveDown(0.5);
    creatives.forEach((c, i) => {
      if (doc.y > 500) doc.addPage();
      doc.fontSize(11).fillColor('#1e3a5f').text(`Creative ${i + 1}:`);
      doc.fontSize(10).fillColor('#333333')
        .text(`  Description: ${c.description || 'N/A'}`)
        .text(`  Status: ${c.status}`);
      if (c.creativeImageUrl) embedImage(doc, c.creativeImageUrl);
      doc.moveDown();
    });

    // Section 4: Work Order Info
    if (doc.y > 550) doc.addPage();
    doc.moveDown();
    doc.fontSize(16).fillColor('#1e3a5f').text('4. Work Order Details');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333333')
      .text(`Work Order ID: ${workOrder._id}`)
      .text(`Status: ${workOrder.status}`)
      .text(`Issued Date: ${new Date(workOrder.issuedDate).toLocaleDateString()}`)
      .text(`Creatives Included: ${creatives.length}`);

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
