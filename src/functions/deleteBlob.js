const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('deleteBlob', {
    methods: ['DELETE'],
    authLevel: 'anonymous', // change to 'function' for better security
    handler: async (request, context) => {
        const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = 'dummyfiles';

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
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blockBlobClient = containerClient.getBlockBlobClient(fileName);

            const exists = await blockBlobClient.exists();

            if (!exists) {
                return {
                    status: 404,
                    body: 'File not found',
                };
            }

            await blockBlobClient.delete();

            return {
                status: 200,
                jsonBody: { message: 'File deleted successfully' },
            };
        } catch (error) {
            context.log('Delete error:', error.message);
            return {
                status: 500,
                body: 'Failed to delete blob',
            };
        }
    },
});
