const { app } = require('@azure/functions');
require('dotenv').config();
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('getHTML', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const formData = await request.formData();
    const containerName = formData.get('containerName');
    const fileName = formData.get('fileName');

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(`dummyfiles/${fileName}`);
      
      const downloadBlockBlobResponse = await blobClient.download();
      const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
        body: downloaded,
      };
    } catch (error) {
      context.log('Error reading HTML file:', error.message);
      return {
        status: 500,
        body: 'Error reading HTML file',
      };
    }
  }
});

// Utility function to read stream into a string
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}
