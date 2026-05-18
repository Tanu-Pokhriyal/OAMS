const Invoice = require('../models/Invoice');
const Campaign = require('../models/Campaign');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const { notify } = require('../socket/notificationHelper');
const XLSX = require('xlsx');

// Admin billing: query all invoices with optional campaignId filter
exports.getAll = async (req, res) => {
  try {
    const { campaignId, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    // Support searching by human-readable campaignId (e.g. CAMP-0001)
    if (campaignId) {
      const campaigns = await Campaign.find({
        campaignId: { $regex: campaignId, $options: 'i' },
      }).select('_id');
      if (campaigns.length > 0) {
        filter.campaignId = { $in: campaigns.map(c => c._id) };
      } else {
        return res.json([]);
      }
    }

    const invoices = await Invoice.find(filter)
      .populate({ path: 'campaignId', select: 'title campaignId budget clientId', populate: { path: 'clientId', select: 'name email' } })
      .populate('vendorId', 'name email')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Export billing to Excel
exports.exportBillingExcel = async (req, res) => {
  try {
    const { campaignId, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (campaignId) {
      const campaigns = await Campaign.find({
        campaignId: { $regex: campaignId, $options: 'i' },
      }).select('_id');
      if (campaigns.length > 0) {
        filter.campaignId = { $in: campaigns.map(c => c._id) };
      } else {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), 'Billing');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="billing.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buf);
      }
    }

    const invoices = await Invoice.find(filter)
      .populate({ path: 'campaignId', select: 'title campaignId budget clientId', populate: { path: 'clientId', select: 'name email' } })
      .populate('vendorId', 'name email')
      .sort({ createdAt: -1 });

    const rows = invoices.map(inv => ({
      'Campaign ID': inv.campaignId?.campaignId || '',
      'Campaign Title': inv.campaignId?.title || '',
      'Client': inv.campaignId?.clientId?.name || '',
      'Vendor': inv.vendorId?.name || '',
      'Amount (₹)': inv.amount,
      'Status': inv.status,
      'Date': new Date(inv.createdAt).toLocaleDateString(),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Billing');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="billing.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { campaignId, workOrderId, amount } = req.body;
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'client_verified') {
      return res.status(400).json({ message: 'Installation must be verified before invoicing' });
    }

    let invoiceFileUrl = '';
    if (req.file) invoiceFileUrl = `/uploads/${req.file.filename}`;

    const invoice = await Invoice.create({
      campaignId, workOrderId, vendorId: req.user._id, amount, invoiceFileUrl,
    });
    campaign.status = 'invoiced';
    await campaign.save();

    // Notify admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await notify({
        userId: admin._id,
        title: 'Invoice Received',
        message: `Invoice received from vendor for campaign "${campaign.title}"`,
        type: 'invoice_received',
        referenceId: invoice._id,
        referenceModel: 'Invoice',
      });
    }
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getByCampaign = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ campaignId: req.params.campaignId })
      .populate('vendorId', 'name email');
    if (!invoice) return res.status(404).json({ message: 'No invoice found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sendToClient = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    const campaign = await Campaign.findById(invoice.campaignId);
    await notify({
      userId: campaign.clientId,
      title: 'Invoice Ready',
      message: `Invoice for campaign "${campaign.title}" is ready for your review`,
      type: 'invoice_received',
      referenceId: invoice._id,
      referenceModel: 'Invoice',
    });
    res.json({ message: 'Invoice sent to client' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.review = async (req, res) => {
  try {
    const { action, remarks } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    const campaign = await Campaign.findById(invoice.campaignId);

    if (action === 'accept') {
      invoice.status = 'accepted';
      campaign.status = 'invoice_accepted';
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await notify({
          userId: admin._id,
          title: 'Invoice Accepted',
          message: `Client accepted invoice for campaign "${campaign.title}"`,
          type: 'invoice_accepted',
          referenceId: invoice._id,
          referenceModel: 'Invoice',
        });
      }
    } else if (action === 'reject') {
      invoice.status = 'rejected';
      invoice.clientRemarks = remarks || '';
      campaign.status = 'invoice_rejected';
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await notify({
          userId: admin._id,
          title: 'Invoice Rejected',
          message: `Client rejected invoice for "${campaign.title}". Remarks: ${remarks || 'N/A'}`,
          type: 'invoice_rejected',
          referenceId: invoice._id,
          referenceModel: 'Invoice',
        });
      }
      await notify({
        userId: invoice.vendorId,
        title: 'Invoice Rejected',
        message: `Invoice for campaign "${campaign.title}" was rejected. Remarks: ${remarks || 'N/A'}`,
        type: 'invoice_rejected',
        referenceId: invoice._id,
        referenceModel: 'Invoice',
      });
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }
    await invoice.save();
    await campaign.save();
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your invoice' });
    }
    if (invoice.status !== 'rejected') {
      return res.status(400).json({ message: 'Only rejected invoices can be updated' });
    }
    if (req.body.amount) invoice.amount = req.body.amount;
    if (req.file) invoice.invoiceFileUrl = `/uploads/${req.file.filename}`;
    invoice.status = 'pending';
    invoice.clientRemarks = '';
    await invoice.save();

    const campaign = await Campaign.findById(invoice.campaignId);
    campaign.status = 'invoiced';
    await campaign.save();

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
