const { app } = require('@azure/functions');

app.storageBlob('uploadCaculation', {
    path: 'dummyfiles/{name}',
    connection: 'AZURE_STORAGE_CONNECTION_STRING',
    handler: (blob, context) => {
        context.log(`Storage blob function processed blob "${context.triggerMetadata.name}" with size ${blob.length} bytes`);
    }
});
