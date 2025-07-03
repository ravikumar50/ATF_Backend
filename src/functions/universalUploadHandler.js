const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

app.eventGrid('universalUploadHandler', {
  handler: async (event, console) => {
    try {
      const blobUrl = event.data.url;
      const containerName = blobUrl.split('/')[3]; // e.g., dummycontainer3
      const blobName = decodeURIComponent(blobUrl.split('/').slice(4).join('/')); // e.g., dummyfiles/Sample62.trx

      // Skip non-dummyfiles
      if (!blobName.startsWith('dummyfiles/')) {
        console.log(`Ignored blob: ${blobName}`);
        return;
      }

      const fileName = blobName.split('/').pop(); // e.g., Sample62.trx
      console.log(`Processing blob: ${fileName} from container: ${containerName}`);

      // Call the parseTrx API to extract parsed test results
      const res = await fetch(`https://functionapptry.azurewebsites.net/api/parseTrx?filename=${fileName}&containerName=${containerName}`);
      const parsedData = await res.json();

      console.log('Parsed Data:', parsedData);

      // Connect to Blob Storage and target metadata file
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const metadataContainer = blobServiceClient.getContainerClient(containerName);
      const blobClient = metadataContainer.getBlockBlobClient('metadata/database.json');

      let existingData = {};

      // Try downloading and parsing existing database.json
      try {
        const downloadResponse = await blobClient.download();
        const content = await streamToString(downloadResponse.readableStreamBody);
        existingData = JSON.parse(content);
      } catch (err) {
        console.log('No database.json found. Starting fresh.');
        existingData = {};
      }

      // Initialize "Overall" if not present
      if (!existingData["Overall"]) {
        existingData["Overall"] = {};
        for (const key in parsedData) {
          if (key === "expiryDate") continue;
          existingData["Overall"][key] = 0;
        }
      }

      // Update "Overall" with new parsed values
      for (const key in parsedData) {
        if (key === "expiryDate") continue;
        existingData["Overall"][key] = (existingData["Overall"][key] || 0) + parsedData[key];
      }

      // Build final object: preserve existing keys like "About"
      const finalData = {
        ...existingData, // preserve "About" or any other custom data
        Overall: existingData.Overall,
        [fileName]: parsedData
      };

      // Upload the updated JSON to Blob
      const updatedContent = JSON.stringify(finalData, null, 2);
      await blobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });

      console.log(`Successfully updated metadata for ${fileName} in container ${containerName}`);
    } catch (err) {
      console.log(`❌ Error processing blob event: ${err.message}`);
    }
  }
});

// Helper to convert stream to string
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}
