const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('individualCall', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const formData = await request.formData();
    const fileName = formData.get('fileName'); 
    const containerName = formData.get('containerName'); 

    if (!fileName || !containerName) {
      return {
        status: 400,
        body: 'Missing required field: fileName or containerName',
      };
    }

    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) {
      return {
        status: 500,
        body: 'Missing AZURE_STORAGE_CONNECTION_STRING',
      };
    }

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const dbBlobClient = containerClient.getBlobClient('metadata/database.json');

      const buffer = await dbBlobClient.downloadToBuffer();
      const dbJson = JSON.parse(buffer.toString('utf-8'));

      const stats = dbJson[fileName];
      if (!stats) {
        return {
          status: 404,
          body: `No stats found for file: ${fileName}`,
        };
      }

      context.log(`Found stats for file: ${fileName}`, stats);
      return {
        status: 200,
        jsonBody: stats,
      };

    } catch (err) {
      context.log.error('Error accessing or parsing database.json:', err.message);
      return {
        status: 500,
        body: 'Error accessing or parsing database.json',
      };
    }
  },
});
