const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('deleteBlob', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const formData = await request.formData();
    const fileName = formData.get('fileName'); 
    const containerName = formData.get('containerName');
    if (!fileName || !containerName) {
      return {
        status: 400,
        body: 'Missing filename or containerName',
      };
    }

    context.log(`Deleting file '${fileName}' from container '${containerName}'`);

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(containerName);

      // Step 1: Delete the file from dummyfiles/
      const filePath = `dummyfiles/${fileName}`;
      const fileBlobClient = containerClient.getBlockBlobClient(filePath);

      const fileExists = await fileBlobClient.exists();
      if (!fileExists) {
        return {
          status: 404,
          body: 'File not found',
        };
      }

      await fileBlobClient.delete();
      context.log(`Deleted blob: ${filePath}`);

      // Step 2: Read metadata/database.json from same container
      const dbPath = `metadata/database.json`;
      const dbBlobClient = containerClient.getBlockBlobClient(dbPath);

      let existingData = {};

      try {
        const downloadResponse = await dbBlobClient.download();
        const content = await streamToString(downloadResponse.readableStreamBody);
        existingData = JSON.parse(content);
        context.log('Loaded metadata/database.json');
      } catch (err) {
        context.log('Failed to read metadata/database.json:', err.message);
        return {
          status: 500,
          body: 'Could not read metadata',
        };
      }

      // Step 3: Update Overall & remove file entry
      const fileData = existingData[fileName];
      const overallData = existingData['Overall'];

      if (fileData && overallData) {
        for (const key in fileData) {
          if (typeof fileData[key] === 'number') {
            overallData[key] = Math.max(0, (overallData[key] || 0) - fileData[key]);
          }
        }
        delete existingData[fileName];
        context.log(`Updated 'Overall' and removed '${fileName}' from metadata`);
      }

      // Step 4: Upload updated database.json
      const updatedContent = JSON.stringify(existingData, null, 2);
      await dbBlobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
        overwrite: true,
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });

      context.log('Updated metadata/database.json uploaded');

      return {
        status: 200,
        jsonBody: { message: 'File and metadata deleted successfully' },
      };

    } catch (error) {
      context.log('Delete error:', error.message);
      return {
        status: 500,
        body: 'Internal Server Error',
      };
    }
  }
});

// Helper
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}
