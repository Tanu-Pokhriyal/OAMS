const router = require('express').Router();
const c = require('../controllers/campaignController');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, authorize('client'), c.create);
router.get('/', auth, c.getAll);
router.get('/template', auth, c.downloadTemplate);
router.post('/template', auth, authorize('admin'), upload.single('template'), c.uploadTemplate);
router.get('/:id', auth, c.getById);
router.put('/:id', auth, authorize('client'), c.update);
router.post('/:id/upload-document', auth, authorize('client'), upload.single('additionalDoc'), c.uploadDocument);
router.patch('/:id/review', auth, authorize('admin'), c.review);
router.patch('/:id/allocate-vendor', auth, authorize('admin'), c.allocateVendor);

module.exports = router;
