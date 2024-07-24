const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const errorHandlor = require("./middleware/errorHandler");
const connectDb = require("./config/dbConnection");
const dotenv = require("dotenv").config();
const validateToken = require("./middleware/validateTokenHandler");
const session = require("express-session");
const cors = require("cors");
const flash = require("connect-flash");
const msal = require("@azure/msal-node");
const constants = require("./constants");
const jwt = require("jsonwebtoken");
const graph = require("./graph.js");
const cron = require("node-cron");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const {
  syncmails,
  refreshToken,
} = require("./controllers/outlookController.js");

/**
 * Create an instance of the Express.js app
 */
const app = express();
const server = http.createServer(app);
// chat socket included
const configureSockets = require("./sockets/chatSocket"); // Replace with the actual path
configureSockets(server);
//
const io = socketIo(server);


app.use('/socket.io', express.static(__dirname + '/node_modules/socket.io/client-dist'));


/**
 * Set the port for the server
 *
 * @example
 * process.env.PORT = 5000;
 */
connectDb();

/**
 * Set the port for the server
 *
 * @example
 * process.env.PORT = 5000;
 */
const port = process.env.PORT || 5000;


/**
 * Configure Express.js middleware
 */
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.OAUTH_CLIENT_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.locals.users = {};

/**
 * Set up MSAL configuration
 *
 * @example
 * process.env.OAUTH_CLIENT_ID = "your_client_id";
 * process.env.OAUTH_AUTHORITY = "https://login.microsoftonline.com/your_tenant_id";
 * process.env.OAUTH_CLIENT_SECRET = "your_client_secret";
 */
const msalConfig = {
  auth: {
    clientId: process.env.OAUTH_CLIENT_ID || "",
    authority: process.env.OAUTH_AUTHORITY,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (!containsPii) console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    },
  },
};

/**
 * Create an instance of the MSAL client
 */
let msalClient = new msal.ConfidentialClientApplication(msalConfig);
app.locals.msalClient = msalClient;
// Flash middleware
app.use(flash());

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

// <FormatDateSnippet>
var hbs = require("hbs");
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/login.css", express.static(__dirname + "/views/auth/login.css"));

app.get("/", validateToken, async (req, res) => {
  const user = req?.user;
  console.log(user);
  res.render("index", { user: user, msAcc:user?.msAcc });
});
app.get("/mails", (req, res) => {
  res.sendFile(path.join(__dirname, ".", "views", "mails.html"));
});
app.use("/auth", require("./routes/auth"));

app.use("/api/users", require("./routes/userRoutes"));
app.use("/", require("./routes/webhook"));
// app.use(errorHandlor);
app.get("/sync-mails", validateToken, syncmails);

app.get("/refresh-token", validateToken, refreshToken);
// app.use(
//   "/socket.io",
//   express.static(__dirname + "/node_modules/socket.io/client-dist")
// );


// Schedule the cron job to run every hour
cron.schedule("0 * * * *", async () => {
  console.log("Running cron job to create or renew subscriptions");
  // Get user IDs from app.locals
  const msalClient = app.locals.msalClient; // Access the msalClient
  const userId = app.locals?.userMsId;
  const notificationUrl =
    process.env.NOTIFICATION_URL + userId + "/webhook"; // Your webhook URL
  // console.log("cron user :", userId);
  // console.log("cron url :", notificationUrl);

  if (userId) {
    try {
      await graph.createSubscription(msalClient, userId, notificationUrl);
    } catch (error) {
      console.error(
        `Failed to create or renew subscription for user ${userId}:`,
        error
      );
    }
  }
  console.log("Cron job completed");
});

// app.use(errorHandlor);

// Start the HTTP server
server.listen(port, () => {
  console.log("Server is running on port " + port);
});
