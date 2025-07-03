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

      // Special case: if projectName is "User", only add email with empty array if not exists
      if (projectName === "User") {
        if (!content[email]) {
          content[email] = [];

          const updatedContent = JSON.stringify(content, null, 2);
          await blobClient.uploadData(Buffer.from(updatedContent), { overwrite: true });

          return {
            status: 200,
            body: `Email '${email}' added as 'User' with no projects.`,
          };
        } else {
          return {
            status: 200,
            body: `Email '${email}' already exists. No update made.`,
          };
        }
      }

      // Standard project add logic
      if (!content[email]) {
        content[email] = [];
      }

      if (!content[email].includes(projectName)) {
        content[email].push(projectName);

        const updatedContent = JSON.stringify(content, null, 2);
        await blobClient.uploadData(Buffer.from(updatedContent), { overwrite: true });

        return {
          status: 200,
          body: `Project '${projectName}' added for ${email}.`,
        };
      } else {
        return {
          status: 200,
          body: `Project '${projectName}' already exists for ${email}.`,
        };
      }
    } catch (err) {
      context.log('Failed to update mapping.json:', err.message);
      return {
        status: 500,
        body: 'Error updating mapping.json',
      };
    }
  },
});
