const mongoose = require('mongoose');

const mailboxSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Inbox', 'Sent', 'Drafts', 'Spam', 'Trash'], // Example mailbox types
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

const Mailbox = mongoose.model('Mailbox', mailboxSchema);

module.exports = Mailbox;
