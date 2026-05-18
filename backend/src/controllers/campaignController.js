const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { notify } = require('../socket/notificationHelper');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const TEMPLATE_PATH = path.join(__dirname, '..', 'uploads', 'campaign_template.xlsx');

// Generate default template if none exists
function ensureTemplate() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    const wb = XLSX.utils.book_new();
    const data = [
      ['Campaign Additional Details Template'],
      [''],
      ['Please fill out all required fields below and upload this file back.'],
      [''],
      ['Field', 'Value', 'Notes'],
      ['Company Legal Name', '', 'As registered'],
      ['Company Registration No.', '', 'CIN / Registration number'],
      ['Authorized Signatory Name', '', 'Person authorized to sign contracts'],
      ['Authorized Signatory Designation', '', 'e.g., Director, Manager'],
      ['Billing Address', '', 'Full billing address with PIN code'],
      ['Shipping / Site Address', '', 'Where materials will be delivered'],
      ['GSTIN', '', '15-digit GST identification number'],
      ['PAN Number', '', '10-character PAN'],
      ['Contact Person Name', '', 'Primary point of contact'],
      ['Contact Phone', '', 'With country code'],
      ['Contact Email', '', 'For campaign correspondence'],
      ['Preferred Installation Dates', '', 'Date range or specific dates'],
      ['Special Requirements', '', 'Any special installation or material needs'],
      ['Target Audience Description', '', 'Describe the intended audience'],
      ['Reference Designs / Links', '', 'URLs or descriptions of design references'],
      ['Consent for Terms & Conditions', '', 'Yes / No'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 35 }, { wch: 45 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Campaign Details');
    XLSX.writeFile(wb, TEMPLATE_PATH);
  }
}

exports.create = async (req, res) => {
  try {
    const { title, brief, budget, targetLocations, startDate, endDate, category, categoryOther, preferredLocations } = req.body;
    const campaign = await Campaign.create({
      title, brief, budget, targetLocations, startDate, endDate,
      category, categoryOther, preferredLocations,
      clientId: req.user._id,
      status: 'awaiting_documents',
    });
    // Notify client to upload additional documents
    await notify({
      userId: req.user._id,
      title: 'Upload Required Documents',
      message: `Please download the template and upload additional details for campaign "${title}"`,
      type: 'campaign_reviewed',
      referenceId: campaign._id,
      referenceModel: 'Campaign',
    });
    // Notify all admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await notify({
        userId: admin._id,
        title: 'New Campaign',
        message: `New campaign "${title}" submitted — awaiting client documents`,
        type: 'campaign_reviewed',
        referenceId: campaign._id,
        referenceModel: 'Campaign',
      });
    }
    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'client') filter.clientId = req.user._id;
    else if (req.user.role === 'vendor') filter.vendorId = req.user._id;
    const campaigns = await Campaign.find(filter)
      .populate('clientId', 'name email')
      .populate('vendorId', 'name email')
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('clientId', 'name email')
      .populate('vendorId', 'name email');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your campaign' });
    }
    if (campaign.status !== 'rework_required') {
      return res.status(400).json({ message: 'Campaign can only be updated when rework is required' });
    }
    const { title, brief, budget, targetLocations, startDate, endDate, category, categoryOther, preferredLocations } = req.body;
    Object.assign(campaign, { title, brief, budget, targetLocations, startDate, endDate, category, categoryOther, preferredLocations, status: 'pending_approval', adminRemarks: '' });
    await campaign.save();
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await notify({
        userId: admin._id,
        title: 'Campaign Resubmitted',
        message: `Campaign "${campaign.title}" resubmitted after rework`,
        type: 'campaign_reviewed',
        referenceId: campaign._id,
        referenceModel: 'Campaign',
      });
    }
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.review = async (req, res) => {
  try {
    const { action, remarks } = req.body; // action: approve | reject | rework
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'pending_approval') {
      return res.status(400).json({ message: 'Campaign is not pending approval' });
    }
    if (action === 'approve' && !campaign.additionalDocUrl) {
      return res.status(400).json({ message: 'Cannot approve: client has not uploaded the required additional documents' });
    }
    let notifType, notifTitle, notifMsg;
    if (action === 'approve') {
      campaign.status = 'approved';
      notifType = 'campaign_reviewed';
      notifTitle = 'Campaign Approved';
      notifMsg = `Your campaign "${campaign.title}" has been approved`;
    } else if (action === 'reject') {
      campaign.status = 'rejected';
      campaign.adminRemarks = remarks || '';
      notifType = 'campaign_reviewed';
      notifTitle = 'Campaign Rejected';
      notifMsg = `Your campaign "${campaign.title}" has been rejected. Reason: ${remarks || 'N/A'}`;
    } else if (action === 'rework') {
      campaign.status = 'rework_required';
      campaign.adminRemarks = remarks || '';
      notifType = 'campaign_rework';
      notifTitle = 'Rework Required';
      notifMsg = `Your campaign "${campaign.title}" needs rework. Remarks: ${remarks || 'N/A'}`;
    } else {
      return res.status(400).json({ message: 'Invalid action. Use approve, reject, or rework' });
    }
    await campaign.save();
    await notify({
      userId: campaign.clientId,
      title: notifTitle, message: notifMsg, type: notifType,
      referenceId: campaign._id, referenceModel: 'Campaign',
    });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.allocateVendor = async (req, res) => {
  try {
    const { vendorId } = req.body;
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'approved') {
      return res.status(400).json({ message: 'Campaign must be approved before vendor allocation' });
    }
    const vendor = await User.findOne({ _id: vendorId, role: 'vendor' });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    campaign.vendorId = vendorId;
    campaign.status = 'vendor_allocated';
    await campaign.save();
    await notify({
      userId: vendorId,
      title: 'New Campaign Assignment',
      message: `You have been assigned to campaign "${campaign.title}"`,
      type: 'vendor_allocated',
      referenceId: campaign._id,
      referenceModel: 'Campaign',
    });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Client uploads additional document for a campaign
exports.uploadDocument = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your campaign' });
    }
    if (!['awaiting_documents', 'rework_required'].includes(campaign.status)) {
      return res.status(400).json({ message: 'Campaign is not awaiting documents' });
    }
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    campaign.additionalDocUrl = `/uploads/${req.file.filename}`;
    campaign.status = 'pending_approval';
    await campaign.save();

    // Notify admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await notify({
        userId: admin._id,
        title: 'Documents Uploaded',
        message: `Client uploaded additional documents for campaign "${campaign.title}" — ready for review`,
        type: 'campaign_reviewed',
        referenceId: campaign._id,
        referenceModel: 'Campaign',
      });
    }
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin uploads the global template
exports.uploadTemplate = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Move uploaded file to the fixed template path
    const dest = TEMPLATE_PATH;
    fs.copyFileSync(req.file.path, dest);
    fs.unlinkSync(req.file.path);
    res.json({ message: 'Template uploaded successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Download the template
exports.downloadTemplate = async (req, res) => {
  try {
    ensureTemplate();
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.download(TEMPLATE_PATH, 'campaign_additional_details_template.xlsx');
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
