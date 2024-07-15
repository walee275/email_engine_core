const mongoose = require("mongoose");

const emailSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
  },
  subject: {
    type: String,
    required: true,
  },
  from: {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  sender: {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  bodyPreview: {
    type: String,
    required: true,
  },
  toRecipients: [
    {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
    },
  ],
  receivedDateTime: {
    type: Date,
    required: true,
  },
  sentDateTime: {
    type: Date,
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  mailbox_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mailbox",
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const Email = mongoose.model("Email", emailSchema);

module.exports = Email;
