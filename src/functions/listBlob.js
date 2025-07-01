const { app } = require('@azure/functions');
require('dotenv').config()
const { BlobServiceClient } = require('@azure/storage-blob');
app.http('listBlob', {
    methods: ['GET'],
    authLevel: 'anonymous', // Change to 'function' if you want security
    handler: async (request, context) => {
        const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const formData = await request.formData();
        const containerName = formData.get('containerName'); 
        

        try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient(containerName);

            let blobItems = [];
            const prefix = "dummyfiles/";
            for await (const blob of containerClient.listBlobsFlat({ prefix })) {
                // Skip folder placeholder (if exists)
                if (blob.name === prefix) continue;

                const blobUrl = `${containerClient.url}/${blob.name}`;
                blobItems.push({
                    name: blob.name.replace(prefix, ""), // remove folder prefix from name
                    url: blobUrl,
                });
            }


            return {
                status: 200,
                jsonBody: blobItems,
            };

        } catch (error) {
            context.log('Error listing blobs:', error.message);
            return {
                status: 500,
                body: 'Error listing blobs',
            };
        }
    }
});
