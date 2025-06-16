const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

// Set up global config

app.setup({
    enableHttpStream: true,
});

// Define HTTP-triggered function
app.http('listBlobs', {
    methods: ['GET'],
    authLevel: 'anonymous', // Change to 'function' if you want security
    handler: async (request, context) => {
        const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = 'dummyfiles'; // Replace with your actual container name

        try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient(containerName);

            let blobItems = [];
            for await (const blob of containerClient.listBlobsFlat()) {
                const blobUrl = `${containerClient.url}/${blob.name}`;
                blobItems.push({
                    name: blob.name,
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

        // Set headers to allow browser viewing
        await blockBlobClient.uploadData(await file.arrayBuffer(), {
            blobHTTPHeaders: {
            blobContentType: file.type,
            blobContentDisposition: "inline",
            }
        });

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
