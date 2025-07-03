const { app } = require('@azure/functions');
const fetch = require('node-fetch');
const FormData = require('form-data'); // Install this: npm install form-data

app.http('addUser', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const formData = await request.formData();
    const email = formData.get("email");
    const role = formData.get("role");

    if (!email || !role) {
      return { status: 400, body: "Missing email or role" };
    }

    const tenantId = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;

    try {
      // Step 1: Get Graph API token
      const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          scope: "https://graph.microsoft.com/.default",
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }),
      });

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) throw new Error("Failed to get access token");

      // Step 2: Send invitation
      const inviteRes = await fetch("https://graph.microsoft.com/v1.0/invitations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          invitedUserEmailAddress: email,
          inviteRedirectUrl: "https://your-frontend-url.com",
          sendInvitationMessage: true,
          invitedUserMessageInfo: {
            customizedMessageBody: `You've been invited as a ${role} to access the system.`
          }
        })
      });

      const inviteData = await inviteRes.json();

      if (!inviteRes.ok) {
        throw new Error(JSON.stringify(inviteData));
      }

      // Step 3: Call addProjectAccess with FormData (correct way)
      const projectAccessForm = new FormData();
      projectAccessForm.append("email", email);
      projectAccessForm.append("projectName", role);


      const url = "https://functionapptry.azurewebsites.net/api/addProjectAccess"
    
      const accessRes = await fetch(url, {
        method: "POST",
        headers: projectAccessForm.getHeaders(), // this is critical!
        body: projectAccessForm,
      });

      const accessBody = await accessRes.text();

      return {
        status: 200,
        jsonBody: {
          message: "Invitation sent and access granted.",
          graphResponse: inviteData,
          accessResponse: accessBody
        }
      };
    } catch (error) {
      context.log("Error adding user:", error.message);
      return { status: 500, body: error.message};
    }
  }
});
