const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const RevokeToken = require("../models/revokedTokenModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const graph = require("../graph.js");
const upload = require("../middleware/uploadFile");
const { Session } = require("inspector");
const { refreshToken } = require("../controllers/outlookController");
// @desc Register a user
// @route POST /api/users/register
// @access public

const register = asyncHandler(async (req, res) => {
  const {name, username, email, password } = req.body;
  if (!name || !username || !email || !password) {
    res.status(404);
    throw new Error("All fields are required");
  }
  const userAlreadyExist = await User.findOne({ email });

  if (userAlreadyExist) {
    res.status(400);
    throw new Error("User already exist");
  }
  // Hash Password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Extract the uploaded file path if it exists
  let profilePicturePath = null;
  if (req.files && req.files.length > 0) {
    profilePicturePath = req.files[0].path;
  }
  const user = await User.create({
    name:name,
    username:username,
    email:email,
    password: hashedPassword,
    microsoft_acc: {},
    profile_picture: profilePicturePath,
  });

  if (user) {
    const accessToken = jwt.sign(
      {
        user: {
          name: user.name,
          username: user.username,
          email: user.email,
          id: user.id,
          msAcc:null
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "60m" }
    );
    req.session.access_token = accessToken;
    res.status(200).json({ accessToken });
    return;
  }
  // res.json({ message: "register user" });
});

// @desc Login a user
// @route POST /api/users/login
// @access public

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(404);
    throw new Error("All fields are required");
  }

  const user = await User.findOne({ email });
  // compare password with hashed pass

  if (user && (await bcrypt.compare(password, user.password))) {
    const accessToken = jwt.sign(
      {
        user: {
          name: user.name,
          username: user.username,
          email: user.email,
          id: user.id,
          msAcc:user?.microsoft_acc
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "60m" }
    );
    req.session.access_token = accessToken;
    req.app.locals.userMsId = user?.microsoft_acc?.microsoft_id;
    req.user = {
      name: user.name,
      username: user.username,
      email: user.email,
      id: user.id,
      msAcc:user?.microsoft_acc
    };
    if(user?.microsoft_acc?.refresh_token){
      refreshToken(req)
    }
    res.status(200).json({ accessToken });
  } else {
    res.status(401);
    throw new Error("Invalid Credantials");
  }
});

const loginWithMs = asyncHandler(async (req, res) => {
  const scopes =
    process.env.OAUTH_SCOPES || "https://graph.microsoft.com/.default";
  const urlParameters = {
    scopes: scopes.split(","),
    redirectUri: process.env.OAUTH_REDIRECT_URI,
  };

  try {
    const authUrl = await req.app.locals.msalClient.getAuthCodeUrl(
      urlParameters
    );
    res.redirect(authUrl);
  } catch (error) {
    console.log(`Error: ${error}`);
    req.flash("error_msg", {
      message: "Error getting auth URL",
      debug: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    res.redirect("/");
  }
});


// @desc callback endoint for graph api call
// @route POST /api/auth/callback
// @access public

const msCallback = asyncHandler(async (req, res) => {
  const scopes = process.env.OAUTH_SCOPES || "https://graph.microsoft.com/.default";
  const tokenRequest = {
    code: req.query.code,
    scopes: scopes.split(","),
    grant_type: "authorization_code",
    redirectUri: process.env.OAUTH_REDIRECT_URI,
  };
  console.log("Token request:", tokenRequest);

  try {
    const response = await req.app.locals.msalClient.acquireTokenByCode(
      tokenRequest
    );
    console.log("Token response serialized:", response);

    // Serialize the token cache
    const tokenCache = req.app.locals.msalClient.getTokenCache().serialize();
    req.session.tokenCache = tokenCache;
      console.log("Token cache serialized:", tokenCache);

    const parsedTokenCache = JSON.parse(tokenCache);
    const accountId = response.account.homeAccountId;

    // Extract tokens
    const accessTokenEntry = Object.values(parsedTokenCache.AccessToken).find(
      (entry) => entry.home_account_id === accountId
    );
    const refreshTokenEntry = Object.values(parsedTokenCache.RefreshToken).find(
      (entry) => entry.home_account_id === accountId
    );

    const accessToken = accessTokenEntry.secret;
    const refreshToken = refreshTokenEntry.secret;

    req.app.locals.msAccessToken = accessToken;
    req.app.locals.msRefreshToken = refreshToken;

    // Save the user's homeAccountId in their session
    req.session.userId = accountId;

    // Get user details from Microsoft Graph
    const user = await graph.getUserDetails(
      req.app.locals.msalClient,
      req.session.userId
    );
    console.log("User details fetched :", user);

    const userEmail = user.mail || user.userPrincipalName;

    // Check if user exists in the database
    let existingUser = await User.findOne({
      $or: [{ "microsoft_acc.microsoft_id": accountId }, { email: userEmail }],
    });
    console.log("User details id Db before save:", existingUser);

    if (existingUser) {
      // Update existing user's Microsoft account info
      existingUser.microsoft_acc = {
        microsoft_id: accountId,
        access_token: accessToken,
        refresh_token: refreshToken ?? "",
        token_expiry: response?.expiresOn ?? "",
        time_zone: user.mailboxSettings?.timeZone ?? "",
      }
      // console.log("Updated information: ", existingUser);
    } else {
      // Create a new user if one does not exist
      const userInfo = {
        email: userEmail,
        microsoft_acc: {
          microsoft_id: accountId,
          access_token: accessToken ?? "",
          refresh_token: refreshToken ?? "",
          token_expiry: response?.expiresOn ?? "",
          time_zone: user.mailboxSettings?.timeZone ?? "",
        },
        name: user.displayName,
        username: response.account.username,
        password: await bcrypt.hash("password", 10),
        time_zone: user.mailboxSettings?.timeZone ?? "",
      };

      // console.log("user:", userInfo);
      existingUser = new User(userInfo);
    }
    await existingUser.save();
    console.log("User details id Db after save:", existingUser);

    // Generate JWT token for the user
    const jwtToken = jwt.sign(
      {
        user: {
          username: existingUser.username,
          name: existingUser.name,
          email: existingUser.email,
          id: existingUser.id,
          msAcc: {
            microsoft_id: accountId,
            access_token: accessToken ?? "",
            refresh_token: refreshToken ?? "",
            token_expiry: response?.expiresOn ?? "",
          },
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "60m" }
    );
    console.log("JWT Generated  :", jwtToken);

    req.session.access_token = jwtToken;
    req.app.locals.userMsId = accountId;
    // Redirect to the home route
    res.redirect(`/`);
  } catch (error) {
    req.flash("error_msg", {
      message: "Error completing authentication",
      debug: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    res.status(500).send({ error: "Something went wrong!" + error });
  }
});

// @desc logout a user
// @route GET /api/users/logout
// @access private

const logout = asyncHandler(async (req, res) => {
  try {
    let authHeader = req.header.Authorization || req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
      const revokedToken = await RevokeToken.create({
        token: token,
      });

      if (revokedToken) {
        res.status(201).json({ message: "user logged out successfully!" });
        return;
      } else {
        res.status(401).json({ message: "user logout failed!" });
        return;
      }
      if (!token) {
        res.status(401);
        throw new Error("Authorization Headers missing");
      }
    } else {
      res.status(401);
      throw new Error("User is not authorized");
    }
  } catch (err) {
    console.log(err);
  }
});

module.exports = { login, logout, register, loginWithMs, msCallback };
