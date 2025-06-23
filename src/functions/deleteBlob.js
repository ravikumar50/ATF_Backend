const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('deleteBlob', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    console.log("Hello");
    
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = 'dummyfiles';

    const url = new URL(request.url);
    const fileName = url.searchParams.get('filename');
    context.log('Received DELETE request for file:', fileName);

    if (!fileName) {
      context.log('Missing filename parameter');
      return {
        status: 400,
        body: 'Missing filename parameter',
      };
    }

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

      // Step 1: Delete blob from dummyfiles
      const dummyContainer = blobServiceClient.getContainerClient(containerName);
      const fileBlobClient = dummyContainer.getBlockBlobClient(fileName);
      const fileExists = await fileBlobClient.exists();
      context.log(`File exists in dummyfiles: ${fileExists}`);

      if (!fileExists) {
        return {
          status: 404,
          body: 'File not found',
        };
      }

      await fileBlobClient.delete();
      context.log(`Deleted ${fileName} from dummyfiles container.`);

      // Step 2: Read metadata/database.json
      const metadataContainer = blobServiceClient.getContainerClient('metadata');
      const dbBlobClient = metadataContainer.getBlockBlobClient('database.json');

      let existingData = {};

      try {
        const downloadResponse = await dbBlobClient.download();
        const content = await streamToString(downloadResponse.readableStreamBody);
        existingData = JSON.parse(content);
        context.log('Successfully parsed database.json');
      } catch (err) {
        context.log('Failed to read or parse database.json:', err.message);
        return {
          status: 500,
          body: 'Could not load metadata file',
        };
      }

      const fileData = existingData[fileName];
      const overallData = existingData['Overall'];

      context.log(`Entry in database.json for file ${fileName}:`, fileData);
      context.log('Overall before subtraction:', overallData);

      // Step 3: Subtract from "Overall" and delete file entry
      if (fileData && overallData) {
        for (const key in fileData) {
          if (typeof fileData[key] === 'number') {
            overallData[key] = (overallData[key] || 0) - fileData[key];
            if (overallData[key] < 0) overallData[key] = 0;
          }
        }
        context.log('Overall after subtraction:', overallData);

        delete existingData[fileName];
        context.log(`Deleted ${fileName} entry from database.json`);
      } else {
        context.log(`No matching data found in database.json for ${fileName}`);
      }

      // Step 4: Upload updated database.json
      const updatedContent = JSON.stringify(existingData, null, 2);
      await dbBlobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
        overwrite: true,
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });

      context.log('Uploaded updated database.json to metadata container.');

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
