const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'src', '..', '.env') });
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/billboard_management';

mongoose.connect(uri).then(async () => {
  const Campaign = require('./src/models/Campaign');

  // Backfill missing campaignId fields
  const missing = await Campaign.find({ $or: [{ campaignId: null }, { campaignId: '' }, { campaignId: { $exists: false } }] }).sort({ createdAt: 1 });
  if (missing.length === 0) {
    console.log('All campaigns already have campaignId. Nothing to fix.');
  } else {
    console.log(`Found ${missing.length} campaigns without campaignId. Backfilling...`);
    for (const camp of missing) {
      // Set defaults for fields added later that are now required
      if (!camp.category) camp.category = 'Billboard Advertising';
      // Trigger the pre-save hook which generates campaignId
      await camp.save();
      console.log(`  ${camp.title} → ${camp.campaignId}`);
    }
    console.log('Done!');
  }

  // Verify
  const all = await Campaign.find().select('campaignId title').lean();
  console.log('\n=== All Campaigns ===');
  all.forEach(c => console.log(`  ${c.campaignId} | ${c.title}`));

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
