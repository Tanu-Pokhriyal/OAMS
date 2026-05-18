const router = require('express').Router();
const { register, login, getMe, getVendors, updateProfile, changePassword } = require('../controllers/authController');
const { auth, authorize } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getMe);
router.put('/profile', auth, updateProfile);
router.put('/change-password', auth, changePassword);
router.get('/vendors', auth, authorize('admin'), getVendors);

module.exports = router;
