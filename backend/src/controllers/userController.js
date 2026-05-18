const User = require('../models/User');
const XLSX = require('xlsx');

// Admin creates a new client or vendor
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, gstNo, address, contact, dateOfBirth, dateOfRegistration } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }
    if (!['client', 'vendor'].includes(role)) {
      return res.status(400).json({ message: 'Can only create client or vendor users' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const userData = { name, email, password, role, gstNo, address, contact };
    if (role === 'client' && dateOfBirth) userData.dateOfBirth = dateOfBirth;
    if (role === 'vendor' && dateOfRegistration) userData.dateOfRegistration = dateOfRegistration;

    const user = await User.create(userData);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all users (with optional role & search query filters)
exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};
    if (role && ['client', 'vendor', 'admin'].includes(role)) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { gstNo: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } },
      ];
    }
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single user by id
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update user (admin)
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { name, gstNo, address, contact, dateOfBirth, dateOfRegistration } = req.body;
    if (name) user.name = name;
    if (gstNo !== undefined) user.gstNo = gstNo;
    if (address !== undefined) user.address = address;
    if (contact !== undefined) user.contact = contact;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (dateOfRegistration !== undefined) user.dateOfRegistration = dateOfRegistration;
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Export users to Excel
exports.exportUsersExcel = async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};
    if (role && ['client', 'vendor', 'admin'].includes(role)) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { gstNo: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } },
      ];
    }
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });

    const rows = users.map((u) => ({
      'Name': u.name,
      'Email': u.email,
      'Role': u.role,
      'GST No.': u.gstNo || '',
      'Address': u.address || '',
      'Contact': u.contact || '',
      'Date of Birth': u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString() : '',
      'Date of Registration': u.dateOfRegistration ? new Date(u.dateOfRegistration).toLocaleDateString() : '',
      'Created At': new Date(u.createdAt).toLocaleDateString(),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="users.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
