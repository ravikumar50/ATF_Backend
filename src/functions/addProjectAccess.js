const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('addProjectAccess', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = "projectmetadata";
    const blobName = "mapping.json";

    if (!connStr) {
      return {
        status: 500,
        body: 'Missing AZURE_STORAGE_CONNECTION_STRING environment variable.',
      };
    }

    try {
      const formData = await request.formData();
      const email = formData.get('email');
      const projectName = formData.get('projectName');
      const name = formData.get('name'); // don't default to ''

      if (!email || !projectName) {
        return {
          status: 400,
          body: 'Missing email or projectName in form data.',
        };
      }

      const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlockBlobClient(blobName);

      // Download and parse mapping.json
      const buffer = await blobClient.downloadToBuffer();
      const content = JSON.parse(buffer.toString('utf-8'));

      // Special case: "User" project
      if (projectName === "User") {
        if (!content[email]) {
          content[email] = [];
          if (name) content[email].push(name);
        }

        const updatedContent = JSON.stringify(content, null, 2);
        await blobClient.uploadData(Buffer.from(updatedContent), { overwrite: true });

        return {
          status: 200,
          body: `Email '${email}' added as 'User'.`,
        };
      }

      // Standard logic
      if (!content[email]) {
        content[email] = [];
      }

      let preservedName = null;

      if (!name) {
        // Name is not sent — remove last item (assumed name)
        preservedName = content[email].pop();
      }

      // Add project if not already present
      if (!content[email].includes(projectName)) {
        content[email].push(projectName);
      }

      // Add name (from form or preserved) at end
      const finalName = name || preservedName;
      if (finalName && !content[email].includes(finalName)) {
        content[email].push(finalName);
      }

      const updatedContent = JSON.stringify(content, null, 2);
      await blobClient.uploadData(Buffer.from(updatedContent), { overwrite: true });

      return {
        status: 200,
        body: `Project '${projectName}' added for ${email}${finalName ? ` with name '${finalName}'` : ''}.`,
      };
    } catch (err) {
      context.log('Failed to update mapping.json:', err);
      return {
        status: 500,
        body: 'Error updating mapping.json',
      };
    }
  },
});
