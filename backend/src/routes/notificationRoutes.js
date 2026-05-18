const router = require('express').Router();
const c = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

router.get('/', auth, c.getAll);
router.get('/unread-count', auth, c.getUnreadCount);
router.patch('/:id/read', auth, c.markRead);
router.patch('/mark-all-read', auth, c.markAllRead);

module.exports = router;
