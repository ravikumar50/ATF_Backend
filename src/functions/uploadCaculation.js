const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

app.storageBlob('uploadCaculation', {
  path: 'dummyfiles/{name}',
  connection: 'AZURE_STORAGE_CONNECTION_STRING',
  handler: async (blob, context) => {
    const fileName = context.triggerMetadata.name;

    try {
      // Step 1: Call parseTrx API
      const res = await fetch(`https://functionapptry.azurewebsites.net/api/parseTrx?filename=${fileName}`);
      const parsedData = await res.json();

      context.log('Parsed TRX Data:', parsedData);

      // Step 2: Connect to Blob Storage
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const metadataContainer = blobServiceClient.getContainerClient('metadata');
      const blobClient = metadataContainer.getBlockBlobClient('database.json');

      let existingData = {};

      // Step 3: Download and parse existing database.json
      try {
        const downloadResponse = await blobClient.download();
        const content = await streamToString(downloadResponse.readableStreamBody);
        existingData = JSON.parse(content);
      } catch (err) {
        context.log('database.json not found or invalid. Creating a new one.');
        existingData = {};
      }

      // Step 4: Initialize "Overall" if not present
      if (!existingData["Overall"]) {
        existingData["Overall"] = {};
        for (const key in parsedData) {
          existingData["Overall"][key] = 0;
        }
      }

      // Step 5: Update "Overall" by summing values
      for (const key in parsedData) {
        if (typeof parsedData[key] === "number") {
          existingData["Overall"][key] = (existingData["Overall"][key] || 0) + parsedData[key];
        }
      }

      // Step 6: Save the file's data under its fileName
      existingData[fileName] = parsedData;

      // Step 7: Upload updated content
      const updatedContent = JSON.stringify(existingData, null, 2);
      await blobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });

      context.log(`Updated metadata/database.json with results for ${fileName}`);

    } catch (error) {
      context.log('Error:', error.message);
    }
  }
});

// Helper function to read stream into string
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}
