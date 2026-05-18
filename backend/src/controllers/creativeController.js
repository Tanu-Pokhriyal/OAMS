const Creative = require('../models/Creative');
const Campaign = require('../models/Campaign');
const SiteSurvey = require('../models/SiteSurvey');

exports.create = async (req, res) => {
  try {
    const { campaignId, surveyImageId, description } = req.body;
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    let creativeImageUrl = '';
    if (req.file) creativeImageUrl = `/uploads/${req.file.filename}`;

    const creative = await Creative.create({
      campaignId, surveyImageId, creativeImageUrl, description, status: 'pending',
    });
    res.status(201).json(creative);
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
    const creatives = await Creative.find(filter)
      .populate({ path: 'campaignId', select: 'title campaignId status' })
      .sort({ createdAt: -1 });
    res.json(creatives);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getByCampaign = async (req, res) => {
  try {
    const creatives = await Creative.find({ campaignId: req.params.campaignId });
    res.json(creatives);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const creative = await Creative.findById(req.params.id);
    if (!creative) return res.status(404).json({ message: 'Creative not found' });

    if (req.file) creative.creativeImageUrl = `/uploads/${req.file.filename}`;
    if (req.body.description) creative.description = req.body.description;
    if (req.body.status) creative.status = req.body.status;
    await creative.save();

    // If all creatives for this campaign are processed, update campaign status
    const allCreatives = await Creative.find({ campaignId: creative.campaignId });
    const allProcessed = allCreatives.every(c => c.status === 'processed');
    if (allProcessed && allCreatives.length > 0) {
      await Campaign.findByIdAndUpdate(creative.campaignId, { status: 'creatives_ready' });
    }

    res.json(creative);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
