// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

var graph = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");

module.exports = {
  getUserDetails: async function (msalClient, userId) {
    const client = getAuthenticatedClient(msalClient, userId);

    const user = await client
      .api("/me")
      .select("displayName,mail,mailboxSettings,userPrincipalName")
      .get();
    return user;
  },

  getUserEmails: async function (msalClient, userId) {
    const client = getAuthenticatedClient(msalClient, userId);

    const messages = await client
      .api("/me/messages")
      // .select("subject,from,toRecipients,receivedDateTime,isRead")
      .top(50) // Get the top 50 emails
      .get();

    return messages.value.map((message) => ({
      id: message.id,
      subject: message.subject,
      from: message.from.emailAddress,
      toRecipients: message.toRecipients.map(
        (recipient) => recipient.emailAddress.address
      ),
      receivedDateTime: message.receivedDateTime,
      sentDateTime: message.sentDateTime,
      isRead: message.isRead,
      bodyPreview: message.bodyPreview,
    }));
  },

  getReceivedEmails: async function (msalClient, userId) {
    console.log("getReceivedEmails called");
    const client = getAuthenticatedClient(msalClient, userId);

    const messages = await client
      .api("/me/mailFolders/inbox/messages")
      // .select("subject,from,receivedDateTime,isRead")
      .top(50) // Get the top 50 received emails
      .get();
    console.log("mails : ", messages);

    return messages.value.map((message) => ({
      id: message.id,
      subject: message.subject,
      from: message.from.emailAddress,
      toRecipients: message.toRecipients.map((recipient) => recipient),
      receivedDateTime: message.receivedDateTime,
      sentDateTime: message.sentDateTime,
      isRead: message.isRead,
      bodyPreview: message.bodyPreview,
    }));
  },

  getSentEmails: async function (msalClient, userId) {
    const client = getAuthenticatedClient(msalClient, userId);

    const messages = await client
      .api("/me/mailFolders/sentitems/messages")
      // .select("subject,toRecipients,sentDateTime,isRead")
      .top(50) // Get the top 50 sent emails
      .get();

    return messages.value.map((message) => ({
      id: message.id,
      subject: message.subject,
      from: message.from.emailAddress,
      toRecipients: message.toRecipients.map((recipient) => recipient),
      receivedDateTime: message.receivedDateTime,
      sentDateTime: message.sentDateTime,
      isRead: message.isRead,
      bodyPreview: message.bodyPreview,
    }));
  },
  //  getEmailDetails: async function (msalClient, userId, emailId) {
  getEmailDetails: async function (msalClient, userId, messageId) {
    // console.log('client: ', msalClient);
    console.log("userId: ", userId);
    console.log("messageId: ", messageId);
    const client = getAuthenticatedClient(msalClient, userId);

    try {
      console.log("getting email details");
      // Fetch the specific email details using its ID
      const emailDetails = await client
        .api("me/messages/" + messageId)
        // .select("subject,from,toRecipients,receivedDateTime,isRead,bodyPreview")
        .get();
      console.log(
        "emailDetails fetched using resource from notification: ",
        emailDetails
      );
      return {
        id: emailDetails.id,
        subject: emailDetails.subject,
        from: emailDetails.from.emailAddress,
        toRecipients: emailDetails.toRecipients.map((recipient) => recipient),
        receivedDateTime: emailDetails.receivedDateTime,
        sentDateTime: emailDetails.sentDateTime,
        isRead: emailDetails.isRead,
        bodyPreview: emailDetails.bodyPreview,
        parentFolderId:emailDetails.parentFolderId

      };
    } catch (error) {
      console.error("Error fetching email details:", error);
      // throw new Error('Error fetching email details');
      return null;
    }
  },

  getFolderDetails: async function (msalClient, userId, folderId) {
    const client = getAuthenticatedClient(msalClient, userId);
    console.log("folder id: " + folderId);
    try {
      const folder = await client.api(`me/mailFolders/${folderId}`).get();
      return folder;
    } catch (error) {
      console.error("Error fetching folder details:", error);
      // throw new Error('Error fetching folder details');
      return null;
    }
  },

  // <GetCalendarViewSnippet>
  getCalendarView: async function (msalClient, userId, start, end, timeZone) {
    const client = getAuthenticatedClient(msalClient, userId);

    return (
      client
        .api("/me/calendarview")
        // Add Prefer header to get back times in user's timezone
        .header("Prefer", `outlook.timezone="${timeZone}"`)
        // Add the begin and end of the calendar window
        .query({
          startDateTime: encodeURIComponent(start),
          endDateTime: encodeURIComponent(end),
        })
        // Get just the properties used by the app
        .select("subject,organizer,start,end")
        // Order by start time
        .orderby("start/dateTime")
        // Get at most 50 results
        .top(50)
        .get()
    );
  },
  // </GetCalendarViewSnippet>
  // <CreateEventSnippet>
  createEvent: async function (msalClient, userId, formData, timeZone) {
    const client = getAuthenticatedClient(msalClient, userId);

    // Build a Graph event
    const newEvent = {
      subject: formData.subject,
      start: {
        dateTime: formData.start,
        timeZone: timeZone,
      },
      end: {
        dateTime: formData.end,
        timeZone: timeZone,
      },
      body: {
        contentType: "text",
        content: formData.body,
      },
    };

    // Add attendees if present
    if (formData.attendees) {
      newEvent.attendees = [];
      formData.attendees.forEach((attendee) => {
        newEvent.attendees.push({
          type: "required",
          emailAddress: {
            address: attendee,
          },
        });
      });
    }

    // POST /me/events
    await client.api("/me/events").post(newEvent);
  },
  // </CreateEventSnippet>

  // <Create Sbscriptions>
  createSubscription: async function (msalClient, userId, notificationUrl) {
    console.log("subscription info: ", msalClient, userId, notificationUrl);
    const client = getAuthenticatedClient(msalClient, userId);
    console.log("Creating subscription :", client);
    try {
      // Check for existing subscriptions
      const subscriptions = await client.api("/subscriptions").get();
      console.log("Existing subscriptions:", subscriptions.value);
      const currentSubscription = subscriptions.value.find(
        (sub) => sub.resource === "me/messages"
      );
      console.log("Current subscription:", currentSubscription);

      if (currentSubscription) {
        // Renew subscription if it exists
        const renewedSubscription = {
          expirationDateTime: new Date(
            new Date().getTime() + 3600 * 1000
          ).toISOString(), // 1 hour from now
        };
        const response = await client
          .api(`/subscriptions/${currentSubscription.id}`)
          .update(renewedSubscription);
        console.log("Subscription renewed:", currentSubscription.id);
        return response;
      } else {
        // Create a new subscription if none exists
        const newSubscription = {
          changeType: "created,updated",
          notificationUrl: notificationUrl,
          resource: "me/messages",
          expirationDateTime: new Date(
            new Date().getTime() + 3600 * 1000
          ).toISOString(), // 1 hour from now
          clientState: process.env.ACCESS_TOKEN_SECRET, // Optional, for security verification
        };
        const response = await client
          .api("/subscriptions")
          .post(newSubscription);
        console.log("New subscription created:", response.id);
        return response;
      }
    } catch (error) {
      console.error("Error creating or renewing subscription:", error);
      throw new Error("Error creating or renewing subscription");
    }
  },
  // </Create>
};

function getAuthenticatedClient(msalClient, userId) {
  if (!msalClient || !userId) {
    throw new Error(
      `Invalid MSAL state. Client: ${
        msalClient ? "present" : "missing"
      }, User ID: ${userId ? "present" : "missing"}`
    );
  }

  // Initialize Graph client
  const client = graph.Client.init({
    // Implement an auth provider that gets a token
    // from the app's MSAL instance
    authProvider: async (done) => {
      try {
        // Get the user's account
        const account = await msalClient
          .getTokenCache()
          .getAccountByHomeId(userId);

        if (account) {
          // Attempt to get the token silently
          // This method uses the token cache and
          // refreshes expired tokens as needed
          const scopes =
            process.env.OAUTH_SCOPES || "https://graph.microsoft.com/.default";
          const response = await msalClient.acquireTokenSilent({
            scopes: scopes.split(","),
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            account: account,
          });

          // First param to callback is the error,
          // Set to null in success case
          done(null, response.accessToken);
        }
      } catch (err) {
        console.log(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        done(err, null);
      }
    },
  });

  return client;
}
