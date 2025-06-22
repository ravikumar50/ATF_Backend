const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('deleteBlob', {
  methods: ['DELETE'],
  authLevel: 'anonymous', // change to 'function' for better security
  handler: async (request, context) => {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const dummyfilesContainer = 'dummyfiles';
    const metadataContainer = 'metadata';
    const metadataBlobName = 'parsedResults.json';

    const url = new URL(request.url);
    const fileName = url.searchParams.get('filename');

    if (!fileName) {
      return {
        status: 400,
        body: 'Missing filename parameter',
      };
    }

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

      // Delete from dummyfiles container
      const dummyContainerClient = blobServiceClient.getContainerClient(dummyfilesContainer);
      const blobClient = dummyContainerClient.getBlockBlobClient(fileName);

      const exists = await blobClient.exists();
      if (!exists) {
        return {
          status: 404,
          body: 'File not found',
        };
      }

      await blobClient.delete();
      context.log(`Deleted file "${fileName}" from dummyfiles`);

      // Update parsedResults.json in metadata container
      const metadataContainerClient = blobServiceClient.getContainerClient(metadataContainer);
      const metadataBlobClient = metadataContainerClient.getBlockBlobClient(metadataBlobName);

      let parsedResults = [];
      try {
        const downloadResponse = await metadataBlobClient.download();
        const existingJson = await streamToString(downloadResponse.readableStreamBody);
        parsedResults = JSON.parse(existingJson);
      } catch (e) {
        context.log(`parsedResults.json not found or unreadable, skipping update.`);
      }

      const updatedResults = parsedResults.filter(entry => entry.fileName !== fileName);

      await metadataBlobClient.uploadData(Buffer.from(JSON.stringify(updatedResults, null, 2)), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        overwrite: true,
      });

      context.log(`Removed "${fileName}" entry from parsedResults.json`);

      return {
        status: 200,
        jsonBody: { message: 'File and metadata deleted successfully' },
      };
    } catch (error) {
      context.log('Delete error:', error.message);
      return {
        status: 500,
        body: 'Failed to delete blob or update metadata',
      };
    }
  },
});

async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}
