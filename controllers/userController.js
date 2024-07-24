const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const Email = require("../models/emailModel");
const Mailbox = require("../models/mailboxModel");
const RevokeToken = require("../models/revokedTokenModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const upload = require("../middleware/uploadFile");
const graph = require("../graph");

// @desc Update User Info
// @route PUT /api/users/:id
// @access private

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("user Not Found");
  }
  const { username, email, password } = req.body;

  const userAlreadyExist = await User.findOne({
    email: email,
    _id: { $ne: user.id },
  });

  if (userAlreadyExist) {
    res.status(400);
    throw new Error("User already exist");
  }

  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
  }
  console.log(username);

  // Extract the uploaded file path if it exists
  // let profilePicturePath = null;
  // if (req.files && req.files.length > 0) {
  //     profilePicturePath = req.files[0].path;

  // }

  const data = {
    username: username,
    // email: email,
    // password: hashedPassword,
    // profile_picture: profilePicturePath
  };
  const updatedUser = await User.findByIdAndUpdate(req.params.id, data, {
    new: true,
  });

  res.status(200).json({ message: `user updated `, user: updatedUser });
});

// @desc Current User Info
// @route GET /api/users/current
// @access private

const currentUser = asyncHandler(async (req, res) => {
  res.json({ message: "logged in user", user: req.user });
});

// @desc GET User Info
// @route GET /api/users/:id
// @access private

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("user Not Found");
  }
  res
    .status(200)
    .json({
      user: { username: user.username, email: user.email, id: user.id },
    });
});

// @desc GET User Emails
// @route GET /api/users/:id
// @access private

const getUserMails = asyncHandler(async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      res.status(404);
      throw new Error("user Not Found");
    }
    // Get the events
    const emails = await Email.find({user_id: user.id});

    res.render("mail", { emails: emails });
    // res.status(200).json({ data: emails });
  } catch (error) {
    console.error(
      "error occured while fetching emails:",
      error
    );
    res.status(500).json({ message: "Server Error" });
  }
});


// @desc GET User Inbox Emails
// @route GET /api/users/:id/inbox
// @access private

const getUserInboxMails = asyncHandler(async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    let mailbox = await Mailbox.findOne({ user_id: user.id, type: 'Inbox' });

    if (!mailbox) {
       mailbox = await Mailbox.create({
        name: "Inbox",
        type: "Inbox",
        user_id: user.id,
      });
    }

    const emails = await Email.find({ user_id: user.id, mailbox_id: mailbox._id });

    // res.render("mail", { emails: emails, type: 'Inbox' });
    res.status(200).json({ emails: emails });
  } catch (error) {
    console.error("Error occurred while fetching inbox emails:", error);
    res.status(500).json({ message: "Server Error" });
  }
});



// @desc GET User Sent Emails
// @route GET /api/users/:id/sent
// @access private

const getUserSentMails = asyncHandler(async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    let mailbox = await Mailbox.findOne({ user_id: user.id, type: 'Sent' });

    if (!mailbox) {
      mailbox = await Mailbox.create({
       name: "Sent box",
       type: "Sent",
       user_id: user.id,
     });
   }

    const emails = await Email.find({ user_id: user.id, mailbox_id: mailbox._id });

    // res.render("mail", { emails: emails , type: 'Sent' });
    res.status(200).json({ emails: emails });
  } catch (error) {
    console.error("Error occurred while fetching sent emails:", error);
    res.status(500).json({ message: "Server Error" });
  }
});



// @desc all users Info
// @route GET /api/users/current
// @access private

const allUsers = asyncHandler(async (req, res) => {
  try {
    const users = await User.find({}).select(["username", "email"]);

    res.status(200).json({ users: users });
  } catch (err) {
    console.log(err);
  }
});

module.exports = { currentUser, allUsers, updateUser, getUser, getUserMails, getUserSentMails,  getUserInboxMails};
