const router = require('express').Router();
const c = require('../controllers/userController');
const { auth, authorize } = require('../middleware/auth');

router.post('/', auth, authorize('admin'), c.createUser);
router.get('/', auth, authorize('admin'), c.getUsers);
router.get('/export', auth, authorize('admin'), c.exportUsersExcel);
router.get('/:id', auth, authorize('admin'), c.getUserById);
router.put('/:id', auth, authorize('admin'), c.updateUser);

module.exports = router;
