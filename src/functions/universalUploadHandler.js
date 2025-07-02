const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

app.eventGrid('universalUploadHandler', {
    handler:async (event, console) => {
        
        try {
      const blobUrl = event.data.url;
      const containerName = blobUrl.split('/')[3]; // Extract container name from URL
      const blobName = decodeURIComponent(blobUrl.split('/').slice(4).join('/'));

      // Skip non-dummyfiles
      if (!blobName.startsWith('dummyfiles/')) {
        console.log(`Ignored blob: ${blobName}`);
        return;
      }

      const fileName = blobName.split('/').pop();
      console.log(`Processing blob: ${fileName} from container: ${containerName}`);
      // Call your parseTrx API
    //   const res = await fetch(`https://functionapptry.azurewebsites.net/api/parseTrx?filename=${fileName}&containerName=${containerName}`);
      const res = await fetch(`http://localhost:7071/api/parseTrx?filename=${fileName}&containerName=${containerName}`);
      const parsedData = await res.json();

      // Connect to Blob Storage
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const metadataContainer = blobServiceClient.getContainerClient(containerName);
      const blobClient = metadataContainer.getBlockBlobClient('metadata/database.json');

      let existingData = {};

      try {
        const downloadResponse = await blobClient.download();
        const content = await streamToString(downloadResponse.readableStreamBody);
        existingData = JSON.parse(content);
      } catch (err) {
        console.log('No database.json found. Starting fresh.');
        existingData = {};
      }

      // Update "Overall"
      if (!existingData["Overall"]) {
        existingData["Overall"] = {};
        for (const key in parsedData) {
          if (key === "expiryDate") continue;
          existingData["Overall"][key] = 0;
        }
      }

      for (const key in parsedData) {
        if (key === "expiryDate") continue;
        existingData["Overall"][key] = (existingData["Overall"][key] || 0) + parsedData[key];
      }

      // Store parsed data
      existingData[fileName] = parsedData;

      // Upload updated data
      const updatedContent = JSON.stringify(existingData, null, 2);
      await blobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });

      console.log(`Processed ${blobName} from container ${containerName}`);
    } catch (err) {
      console.log(`Error processing blob event: ${err.message}`);
    }
    }
});
