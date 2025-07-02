const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('accessDetails', {
  methods: ['GET'],
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
      const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);

      const buffer = await blobClient.downloadToBuffer();
      const content = JSON.parse(buffer.toString('utf-8'));

      return {
        status: 200,
        jsonBody: content,
      };
    } catch (err) {
      context.log.error('Failed to fetch mapping.json:', err.message);
      return {
        status: 500,
        body: 'Error reading mapping.json',
      };
    }
  },
});
