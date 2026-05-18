const router = require('express').Router();
const c = require('../controllers/siteSurveyController');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, authorize('vendor'), upload.array('images', 20), c.create);
router.get('/', auth, c.getAll);
router.get('/campaign/:campaignId', auth, c.getByCampaign);
router.patch('/:id/select-images', auth, authorize('admin'), c.selectImages);

module.exports = router;
