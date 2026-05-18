const router = require('express').Router();
const c = require('../controllers/workOrderController');
const { auth, authorize } = require('../middleware/auth');

router.post('/', auth, authorize('admin'), c.create);
router.get('/', auth, c.getAll);
router.get('/:id', auth, c.getById);
router.get('/campaign/:campaignId', auth, c.getByCampaign);
router.patch('/:id/close', auth, authorize('admin'), c.close);

module.exports = router;
