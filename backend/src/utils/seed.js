const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const users = [
  { name: 'Admin User', email: 'admin@billboard.com', password: 'admin123', role: 'admin' },
  { name: 'Client User', email: 'client@billboard.com', password: 'client123', role: 'client', gstNo: '29AABCU9603R1ZM', address: '123 MG Road, Delhi', contact: '9876543210', dateOfBirth: new Date('1990-05-15') },
  { name: 'Vendor User', email: 'vendor@billboard.com', password: 'vendor123', role: 'vendor', gstNo: '07AAGCV4567R1ZP', address: '456 Ring Road, Delhi', contact: '9123456789', dateOfRegistration: new Date('2020-01-10') },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/billboard_management';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Clear existing users
  await User.deleteMany({});
  console.log('Cleared users collection');

  // Create users one by one so pre-save hook fires
  for (const u of users) {
    await User.create(u);
    console.log(`Created ${u.role}: ${u.email}`);
  }

  console.log('\nSeed complete! Demo credentials:');
  console.log('  admin@billboard.com  / admin123');
  console.log('  client@billboard.com / client123');
  console.log('  vendor@billboard.com / vendor123');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
