const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const userController = require('../controllers/userController'); // Import entire controller

const router = express.Router();

// Apply `protect` to all routes in this router
router.use(protect);

router.get("/get-user", userController.getUserDetails);

router.put('/update-details', userController.updateUserDetails);

router.put('/upgrade-role', userController.upgradeToDriver);

router.post('/delete-account', userController.requestAccountDeletion);
router.post('/cancel-delete-account', userController.cancelAccountDeletion);

module.exports = router;
 