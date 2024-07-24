const graph = require("../graph.js");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const Mailbox = require("../models/mailboxModel");
const Email = require("../models/emailModel");
const { access } = require("fs");
const socketIo = require('socket.io');
require("../server.js");

// Example handler for handling notifications from Microsoft Graph API
const handleGraphNotification = async (msalClient, userId, notification) => {
  console.log("Notification user:", userId);

  socketIo.emit('newMailRecieved');
  
  const { changeType, resource, resourceData } = notification;


  // let resourceDetails = await graph.getEmailDetails(
  //   msalClient,
  //   userId,
  //   resourceData?.id
  // );
  // console.log("Resource details:", resourceDetails);
  // if (resourceDetails?.id) {
  // }

  const emailId = resourceData?.id; // Extract email ID from resourceData
  const emailDetails = await graph.getEmailDetails(msalClient, userId, emailId);
  // console.log("Folder id in mail :",  emailDetails?.parentFolderId);

  const folderName =
    emailDetails?.parentFolderId != null
      ? await getFolderName(msalClient, userId, emailDetails?.parentFolderId)
      : null;
  console.log("Email details:", emailDetails);
  console.log("Folder name:", folderName);
  console.log("User Id:", userId);
  let mailbox = null;
  let user = await User.findOne({ "microsoft_acc.microsoft_id": userId });

  if (!user) {
    console.log("User not found");
    return;
  }

  if (folderName != null && folderName.toLowerCase().includes("sent")) {
    mailbox = await Mailbox.findOne({ type: "Sent", user_id: user?._id });
  } else if (folderName != null && folderName.toLowerCase().includes("inbox")) {
    mailbox = await Mailbox.findOne({ type: "Inbox", user_id: user?._id });
  }
  if (mailbox && user) {
    let updatedEmails = await createEmails(
      [emailDetails],
      mailbox?.id,
      user?.id
    );
  }

  // Handle different change types
  // switch (changeType) {
  //   case "created":
  //     // Fetch or manipulate the email message using resource or resourceData
  //     console.log("Email created:", resourceData.id);

  //     // Example: Fetch the email details using Microsoft Graph API
  //     // const emailDetails = await getEmailDetails(resource); // Implement getEmailDetails function

  //     // Example: Update your application's state or database
  //     // updateMailboxState(emailDetails);

  //     break;
  //   case "updated":
  //     // Handle updated email logic

  //     break;
  //   case "deleted":
  //     // Handle deleted email logic
  //     console.log("Email deleted:", resourceData.id);
  //     break;
  //   default:
  //     console.log("Unhandled change type:", changeType);
  // }
};

const syncmails = asyncHandler(async (req, res) => {
  try {
    console.log("Syncing", req?.user);


    console.log("client : ", req.app.locals.msalClient);
    // Fetch emails from Microsoft Graph API
    let emails = await graph.getReceivedEmails(
      req.app.locals.msalClient,
      req.user.msAcc.microsoft_id
    );

    // Find or create the mailbox for the user
    let mailbox = await Mailbox.findOne({
      user_id: req.user.id,
      type: "Inbox",
    });
    if (!mailbox) {
      mailbox = new Mailbox({
        name: "Personal Inbox",
        type: "Inbox",
        user_id: req.user.id,
      });
      await mailbox.save();
    }

    //
    let mailsSaved = await createEmails(emails, mailbox.id, req.user.id);
    let emailsSent = await graph.getSentEmails(
      req.app.locals.msalClient,
      req.user.msAcc.microsoft_id
    );

    // Find or create the mailbox for the user
    let sentBox = await Mailbox.findOne({ user_id: req.user.id, type: "Sent" });

    if (!sentBox) {
      sentBox = new Mailbox({
        name: "Sent box",
        type: "Sent",
        user_id: req.user.id,
      });
      await sentBox.save();
    }

    let mailsSavedSent = await createEmails(
      emailsSent,
      sentBox?.id,
      req.user.id
    );

    res.status(200).send({ message: "Emails synchronized successfully" });
  } catch (e) {
    console.error("Failed to acquire token or synchronize emails: ", e);
    res.status(500).send({ error: "Something went wrong" });
  }
});

async function refreshToken(req) {
  const scopes =
    process.env.OAUTH_SCOPES || "https://graph.microsoft.com/.default";
  // console.log("Refreshing user credentials :", req.user);
  const refreshToken = req?.user?.msAcc?.refresh_token; // Ensure this is the refresh token
  const tokenExpiry = new Date(req?.user?.msAcc?.token_expiry); // Ensure this is the token expiry date

  console.log("Expiry token:", tokenExpiry.getTime() < Date.now());
  const isTokenExpired = tokenExpiry.getTime() < Date.now();
  // if (!tokenExpiry || isTokenExpired) {
    console.log("refreshToken: ", refreshToken);
    const tokenRequest = {
      refreshToken: refreshToken,
      scopes: scopes.split(","),
      grant_type: "refresh_token",
      forceCache: true,
    };
    // console.log("Token request: ", tokenRequest);

    try {
      const response =
        await req.app.locals.msalClient.acquireTokenByRefreshToken(
          tokenRequest
        );
      // console.log("Token response: ", response);
      req.session.tokenCache = JSON.stringify({ account: response?.account });
      // Serialize the token cache
      const tokenCache = req.app.locals.msalClient.getTokenCache().serialize();
      req.session.tokenCache = tokenCache;
      // console.log("Token cache serialized:", tokenCache);

      const parsedTokenCache = JSON.parse(tokenCache);
      const accountId = response.account.homeAccountId;

      // Extract tokens
      const accessTokenEntry = await Object.values(
        parsedTokenCache.AccessToken
      ).find((entry) => entry.home_account_id === accountId);
      const refreshTokenEntry = await Object.values(
        parsedTokenCache.RefreshToken
      ).find((entry) => entry.home_account_id === accountId);

      const accessToken = accessTokenEntry?.secret;
      const refreshToken = refreshTokenEntry?.secret;

      req.app.locals.msAccessToken = accessToken;
      req.app.locals.msRefreshToken = refreshToken;

      // Save the user's homeAccountId in their session
      req.session.userId = accountId;
      req.app.locals.userMsId = accountId;

      // Update the user's token expiry date
      req.user.msAcc ={
        refresh_token: refreshToken,
        token_expiry: response?.expiresOn,
        access_token: accessToken,
        time_zone: response.time_zone
      };

      console.log('refreshed expiry :', response?.expiresOn);

      try {
        // Find the user in the database
        const user = await User.findById(req.user.id);
      
        if (user) {
          // Update the user's Microsoft account information
          user.microsoft_acc = {
            microsoft_id: accountId,
            refresh_token: refreshToken,
            token_expiry: response?.expiresOn,
            access_token: accessToken,
            time_zone: response.time_zone
          };
      
          // Save the updated user document
          const updatedUser = await user.save();
          
          // Log the success message
          console.log("Token refreshed successfully", updatedUser, req.app.locals.userMsId);
        } else {
          console.error("User not found");
        }
      } catch (error) {
        console.error("Error updating user tokens:", error);
      }
 

      console.log("token refreshed successfully", req.app.locals.userMsId);
      return response;
    } catch (e) {
      console.error("Failed to acquire token: ", e);
      return null;
    }
  // } else {
  //   return null;
  // }
}

async function createEmails(emails = [], mailboxId = null, userId = null) {
  try {
    console.log("mailboxId: ", mailboxId);
    console.log("userId: ", userId);

    if (!mailboxId || !userId) {
      throw new Error("Invalid mailbox or user ID");
    }

    for (const email of emails) {
      const existingEmail = await Email.findOne({ messageId: email.id });

      if (existingEmail) {
        // Update the existing email
        existingEmail.subject = email.subject;
        existingEmail.from = {
          name: email?.from?.name,
          email: email?.from.address,
        };
        existingEmail.sender = {
          name: email?.from?.name,
          email: email?.from.address,
        };
        existingEmail.bodyPreview = email.bodyPreview;
        existingEmail.toRecipients = email.toRecipients.map((recipient) => ({
          name: recipient.emailAddress.name,
          email: recipient.emailAddress.address,
        }));
        existingEmail.receivedDateTime = email.receivedDateTime;
        existingEmail.sentDateTime = email.sentDateTime;
        existingEmail.isRead = email.isRead;
        existingEmail.mailbox_id = mailboxId;
        existingEmail.user_id = userId;

        await existingEmail.save();
      } else {
        // Create a new email
        const newEmail = new Email({
          messageId: email.id,
          subject: email.subject,
          from: {
            name: email?.from?.name,
            email: email?.from.address,
          },
          sender: {
            name: email?.from?.name,
            email: email?.from.address,
          },
          bodyPreview: email.bodyPreview,
          toRecipients: email.toRecipients.map((recipient) => ({
            name: recipient.emailAddress.name,
            email: recipient.emailAddress.address,
          })),
          receivedDateTime: email.receivedDateTime,
          sentDateTime: email.sentDateTime,
          isRead: email.isRead,
          mailbox_id: mailboxId,
          user_id: userId,
        });

        await newEmail.save();
      }
    }

    return true;
  } catch (e) {
    console.error("Failed to create or update emails: ", e);
    throw new Error("Failed to create or update emails");
  }
}

async function getFolderName(msalClient, userId, parentFolderId) {
  try {
    const folder = await graph.getFolderDetails(
      msalClient,
      userId,
      parentFolderId
    );
    console.log("Folder : ", folder);
    return folder?.displayName; // This will give you the name of the folder
  } catch (error) {
    console.error("Error determining folder name:", error);
    return null;
  }
}

module.exports = { syncmails, handleGraphNotification, refreshToken };
