const cron = require('node-cron');
const express = require('express');
const app = express();
require('../server'); // Ensure this path is correct and points to your server.js file
const { createSubscription } = require('../graph'); // Adjust the path accordingly
const notificationUrl = 'https://197e-2407-d000-d-e71d-28d7-9e8f-d87b-3536.ngrok-free.app/webhook'; // Your webhook URL

// Schedule the cron job to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running cron job to create or renew subscriptions');
  
  // Get user IDs from app.locals
  const msalClient = app.locals.msalClient; // Access the msalClient
  const userId = app.locals?.userMsId;

    if (userId) {
      try {
        await createSubscription(msalClient, userId, notificationUrl);
      } catch (error) {
        console.error(`Failed to create or renew subscription for user ${userId}:`, error);
      }
    }
    console.log('Cron job completed');
});
