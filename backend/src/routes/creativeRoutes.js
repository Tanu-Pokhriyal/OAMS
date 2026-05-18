const router = require('express').Router();
const c = require('../controllers/creativeController');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, authorize('admin'), upload.single('creativeImage'), c.create);
router.get('/', auth, c.getAll);
router.get('/campaign/:campaignId', auth, c.getByCampaign);
router.patch('/:id', auth, authorize('admin'), upload.single('creativeImage'), c.update);

module.exports = router;
