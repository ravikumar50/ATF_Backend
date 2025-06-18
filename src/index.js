const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

// Set up global config

app.setup({
    enableHttpStream: true,
});

// Define HTTP-triggered function




