const router = require('express').Router();
const c = require('../controllers/installationController');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, authorize('vendor'), upload.array('images', 20), c.create);
router.get('/', auth, c.getAll);
router.get('/work-order/:workOrderId', auth, c.getByWorkOrder);
router.get('/campaign/:campaignId', auth, c.getByCampaign);
router.patch('/:id/send-report', auth, authorize('admin'), c.sendReport);
router.patch('/:id/verify', auth, authorize('client'), c.verify);

module.exports = router;
