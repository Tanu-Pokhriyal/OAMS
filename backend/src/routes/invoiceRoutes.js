const router = require('express').Router();
const c = require('../controllers/invoiceController');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, authorize('vendor'), upload.single('invoiceFile'), c.create);
router.get('/', auth, c.getAll);
router.get('/export', auth, authorize('admin'), c.exportBillingExcel);
router.get('/campaign/:campaignId', auth, c.getByCampaign);
router.patch('/:id/send-to-client', auth, authorize('admin'), c.sendToClient);
router.patch('/:id/review', auth, authorize('client'), c.review);
router.put('/:id', auth, authorize('vendor'), upload.single('invoiceFile'), c.update);

module.exports = router;
