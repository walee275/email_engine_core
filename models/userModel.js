const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Please enter user name!"],
    },
    name: {
      type: String,
      required: [true, "Please enter user's name!"],
    },
    email: {
      type: String,
      required: [true, "Please provide your email!"],
      unique: [true, "Email Already taken"],
    },
    password: {
      type: String,
      required: [true, "Please provide your password!"],
    },
    profile_picture: {
      type: String,
      required: [false],
    },
    microsoft_acc: {
      microsoft_id: {
        type: String,
        required: [false],
      },
      refresh_token: {
        type: String,
        required: [false],
      },
      access_token: {
        type: String,
        required: [false],
      },
      token_expiry: {
        type: Date,
        required: [false],
      },
      time_zone: {
        type: String,
        required: [false],
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
