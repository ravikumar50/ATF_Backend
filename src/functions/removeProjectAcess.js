const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('removeProjectAccess', {
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

      const buffer = await blobClient.downloadToBuffer();
      const content = JSON.parse(buffer.toString('utf-8'));

      if (!content[email]) {
        return {
          status: 404,
          body: `No access found for ${email}.`,
        };
      }

      const index = content[email].indexOf(projectName);
      if (index === -1) {
        return {
          status: 404,
          body: `Project '${projectName}' not found for ${email}.`,
        };
      }

      content[email].splice(index, 1);

      // Clean up empty array
      if (content[email].length === 0) {
        delete content[email];
      }

      const updatedContent = JSON.stringify(content, null, 2);
      await blobClient.uploadData(Buffer.from(updatedContent), {
        overwrite: true,
      });

      return {
        status: 200,
        body: `Project '${projectName}' removed for ${email}.`,
      };
    } catch (err) {
      context.log('Failed to update mapping.json:', err.message);
      return {
        status: 500,
        body: 'Error updating mapping.json',
      };
    }
  },
});
