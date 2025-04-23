const cron = require('node-cron');
const User = require('../models/User');

const scheduleUserDeletionJob = () => {
  cron.schedule('0 0 * * *', async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const result = await User.deleteMany({
        isDeletionRequested: true,
        deletionRequestedAt: { $lte: sevenDaysAgo },
      });
      if (result.deletedCount > 0) {
        console.log(`[Cron] Deleted ${result.deletedCount} user(s) scheduled for deletion`);
      }
    } catch (err) {
      console.error('[Cron] Error deleting users:', err.message);
    }
  });
};

module.exports = scheduleUserDeletionJob;
