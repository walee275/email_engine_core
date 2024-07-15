var express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  loginWithMs,
  msCallback,
} = require("../controllers/authController");
const upload = require("../middleware/uploadFile");
const graph = require("../graph.js");
const validateToken = require("../middleware/validateTokenHandler");
const path = require('path');

router.post("/register", upload.single("file"), register);
router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'auth', 'register.html'));
  // res.render("auth/login.html");
});
router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'auth', 'login.html'));
  // res.render("auth/login.html");
});

router.post("/login", login);

// GET Outlook login
router.get("/outlook/login", loginWithMs);


/* GET auth callback. */
router.get("/callback", msCallback);
//
router.post("/logout", validateToken, logout);

module.exports = router;
