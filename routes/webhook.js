const express = require('express');
const router = express.Router();
const { handleGraphNotification } = require('../controllers/outlookController');
router.post('/:id/webhook', (req, res) => {
  const validationToken = req.query.validationToken;
  const userId = req.params.id;
  console.log('Notification received Token:', validationToken);
  
  // Respond with the validation token to verify the webhook endpoint
  if (validationToken) {
    return res.status(200).send(validationToken);
  }

  // Handle notification
  const notifications = req.body.value;
  notifications.forEach(notification => {
    console.log('Notification received:', notification);

    // Process the notification (e.g., fetch updated emails)
    handleGraphNotification(req.app.locals.msalClient, userId, notification);
  });

  res.status(202).send();
});

module.exports = router;
