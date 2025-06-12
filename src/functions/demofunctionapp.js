const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = 'dummyfiles'; // replace with your container name

app.http('demofunctionapp', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

      let blobs = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        const blobUrl = `${containerClient.url}/${blob.name}`;
        blobs.push({ name: blob.name, url: blobUrl });
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blobs)
      };
    } catch (err) {
      context.log(`Error listing blobs: ${err.message}`);
      return {
        status: 500,
        body: `Error retrieving blobs: ${err.message}`
      };
    }
  }
});
