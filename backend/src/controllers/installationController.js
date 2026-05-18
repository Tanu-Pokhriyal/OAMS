const Installation = require('../models/Installation');
const WorkOrder = require('../models/WorkOrder');
const Campaign = require('../models/Campaign');
const Creative = require('../models/Creative');
const SiteSurvey = require('../models/SiteSurvey');
const User = require('../models/User');
const { notify } = require('../socket/notificationHelper');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

exports.create = async (req, res) => {
  try {
    const { workOrderId, imagesMeta: rawMeta } = req.body;
    const wo = await WorkOrder.findById(workOrderId).populate('campaignId');
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    if (wo.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not assigned to this work order' });
    }

    let installImages = [];
    if (req.files && req.files.length > 0) {
      const imagesMeta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : (rawMeta || []);
      installImages = req.files.map((file, i) => ({
        imageUrl: `/uploads/${file.filename}`,
        creativeId: imagesMeta[i]?.creativeId || null,
        description: imagesMeta[i]?.description || '',
      }));
    }

    const installation = await Installation.create({
      workOrderId,
      campaignId: wo.campaignId._id,
      vendorId: req.user._id,
      images: installImages,
      status: 'completed',
    });

    // Generate cumulative installation report PDF
    const pdfPath = path.join(__dirname, '..', 'uploads', `install_${installation._id}.pdf`);
    const populatedCampaign = await Campaign.findById(wo.campaignId._id)
      .populate('clientId', 'name email').populate('vendorId', 'name email');
    const survey = await SiteSurvey.findOne({ campaignId: wo.campaignId._id });
    const creatives = await Creative.find({ campaignId: wo.campaignId._id, status: 'processed' });
    await generateInstallPDF(installation, populatedCampaign, survey, creatives, wo, pdfPath);
    installation.reportPdfUrl = `/uploads/install_${installation._id}.pdf`;
    await installation.save();

    wo.status = 'completed';
    await wo.save();
    const campaign = await Campaign.findById(wo.campaignId._id);
    campaign.status = 'installation_completed';
    await campaign.save();

    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await notify({
        userId: admin._id,
        title: 'Installation Completed',
        message: `Installation for campaign "${campaign.title}" is complete`,
        type: 'installation_completed',
        referenceId: installation._id,
        referenceModel: 'Installation',
      });
    }
    res.status(201).json(installation);
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
    const installations = await Installation.find(filter)
      .populate({ path: 'campaignId', select: 'title campaignId status' })
      .populate('vendorId', 'name email')
      .sort({ createdAt: -1 });
    res.json(installations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getByWorkOrder = async (req, res) => {
  try {
    const installation = await Installation.findOne({ workOrderId: req.params.workOrderId })
      .populate('vendorId', 'name email');
    if (!installation) return res.status(404).json({ message: 'No installation found' });
    res.json(installation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getByCampaign = async (req, res) => {
  try {
    const installation = await Installation.findOne({ campaignId: req.params.campaignId })
      .populate('vendorId', 'name email');
    if (!installation) return res.status(404).json({ message: 'No installation found' });
    res.json(installation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sendReport = async (req, res) => {
  try {
    const installation = await Installation.findById(req.params.id);
    if (!installation) return res.status(404).json({ message: 'Installation not found' });
    const campaign = await Campaign.findById(installation.campaignId);
    await notify({
      userId: campaign.clientId,
      title: 'Installation Report',
      message: `Installation report for campaign "${campaign.title}" is ready for your review`,
      type: 'installation_report_sent',
      referenceId: installation._id,
      referenceModel: 'Installation',
    });
    res.json({ message: 'Report sent to client' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verify = async (req, res) => {
  try {
    const { action, remarks } = req.body; // action: accept | reject | rework
    const installation = await Installation.findById(req.params.id);
    if (!installation) return res.status(404).json({ message: 'Installation not found' });
    const campaign = await Campaign.findById(installation.campaignId);

    if (action === 'accept') {
      installation.status = 'verified';
      campaign.status = 'client_verified';
      // Notify admin and vendor
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await notify({
          userId: admin._id,
          title: 'Installation Verified',
          message: `Client accepted installation for campaign "${campaign.title}"`,
          type: 'installation_verified',
          referenceId: installation._id,
          referenceModel: 'Installation',
        });
      }
      await notify({
        userId: installation.vendorId,
        title: 'Installation Accepted',
        message: `Installation for campaign "${campaign.title}" has been accepted by client`,
        type: 'installation_verified',
        referenceId: installation._id,
        referenceModel: 'Installation',
      });
    } else if (action === 'reject' || action === 'rework') {
      installation.status = 'disputed';
      installation.clientRemarks = remarks || '';
      campaign.status = 'client_disputed';
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await notify({
          userId: admin._id,
          title: 'Installation Disputed',
          message: `Client disputed installation for "${campaign.title}". Remarks: ${remarks || 'N/A'}`,
          type: 'installation_disputed',
          referenceId: installation._id,
          referenceModel: 'Installation',
        });
      }
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }
    await installation.save();
    await campaign.save();
    res.json(installation);
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

// --- Cumulative Installation Report PDF ---
function generateInstallPDF(installation, campaign, survey, creatives, workOrder, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title
    doc.fontSize(22).text('Installation Report', { align: 'center' });
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

    // Section 4: Work Order Details
    if (doc.y > 550) doc.addPage();
    doc.moveDown();
    doc.fontSize(16).fillColor('#1e3a5f').text('4. Work Order Details');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333333')
      .text(`Work Order ID: ${workOrder._id}`)
      .text(`Status: ${workOrder.status}`)
      .text(`Issued Date: ${new Date(workOrder.issuedDate).toLocaleDateString()}`)
      .text(`Creatives Included: ${creatives.length}`);
    doc.moveDown();

    // Section 5: Installation Details
    doc.addPage();
    doc.fontSize(16).fillColor('#1e3a5f').text('5. Installation Details');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333333')
      .text(`Installation Date: ${new Date(installation.createdAt || Date.now()).toLocaleDateString()}`)
      .text(`Status: ${installation.status}`)
      .text(`Total Installation Images: ${installation.images.length}`);
    doc.moveDown(0.5);

    installation.images.forEach((img, i) => {
      if (doc.y > 500) doc.addPage();
      doc.fontSize(11).fillColor('#1e3a5f').text(`Installation Image ${i + 1}:`);
      doc.fontSize(10).fillColor('#333333')
        .text(`  Description: ${img.description || 'N/A'}`);
      embedImage(doc, img.imageUrl);
      doc.moveDown();
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
