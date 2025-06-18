const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
app.http('uploadBlob', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = 'dummyfiles';

        try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient(containerName);

            const formData = await request.formData();
            const file = formData.get('file');
            const fileName = file.name;

            const blockBlobClient = containerClient.getBlockBlobClient(fileName);
            await blockBlobClient.uploadData(await file.arrayBuffer());

            return {
                status: 200,
                jsonBody: { message: 'Upload successful', url: blockBlobClient.url }
            };
        } catch (error) {
            context.log('Upload error:', error.message);
            return {
                status: 500,
                body: 'Upload failed'
            };
        }
    }
});
