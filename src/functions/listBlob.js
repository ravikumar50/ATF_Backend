const { app } = require('@azure/functions');
require('dotenv').config()
const { BlobServiceClient } = require('@azure/storage-blob');
app.http('listBlob', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous', // Change to 'function' if you want security
    handler: async (request, context) => {
        const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const formData = await request.formData();
        const containerName = formData.get('containerName'); // Replace with your actual container name
                

        try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient(containerName);

            let blobItems = [];
            for await (const blob of containerClient.listBlobsFlat({ prefix: 'dummyfiles/' })) {
                const cleanedName = blob.name.replace('dummyfiles/', '');
                if (!cleanedName) continue;
                blobItems.push({
                    name: cleanedName
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
