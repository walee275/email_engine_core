const express = require("express");
const {  currentUser, allUsers, updateUser, getUser, getUserMails, getUserInboxMails, getUserSentMails } = require("../controllers/userController");
const validateToken = require("../middleware/validateTokenHandler");
const path = require("path");

const router = express.Router();


router.get("/list", validateToken, allUsers);
router.get("/current", validateToken, currentUser);
// router.get("/mails", validateToken, getUserMails);
router.get("/inbox", validateToken, getUserInboxMails);
router.get("/sent-box", validateToken, getUserSentMails);
router.route("/:id", validateToken ).put(updateUser).get(getUser);
router.get("/mails", (req, res) => {
    res.sendFile(path.join(__dirname, ".", "views", "mails.html"));
    // res.render("auth/login.html");
  });




module.exports = router;
