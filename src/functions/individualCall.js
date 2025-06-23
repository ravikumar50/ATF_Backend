/**
 * Azure Function to fetch database.json from Blob Storage, extract stats for a given file, and return them.
 */
const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('individualCall', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // Read fileName from JSON body
    const fileName = request.params.fileName;
    console.log(request)
    context.log(`Received fileName from body: ${fileName}`);

    // Validate input
    if (!fileName) {
      return {
        status: 400,
        body: 'Missing required field: fileName in request body',
      };
    }

    // Ensure storage connection string is set
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) {
      return {
        status: 500,
        body: 'Server configuration error: missing AZURE_STORAGE_CONNECTION_STRING',
      };
    }

    // Initialize blob client for database.json
    const containerClient = BlobServiceClient
      .fromConnectionString(connStr)
      .getContainerClient('metadata');
    const dbBlobClient = containerClient.getBlobClient('database.json');

    // Download and parse database.json
    let dbJson;
    try {
      const buffer = await dbBlobClient.downloadToBuffer();
      dbJson = JSON.parse(buffer.toString('utf-8'));
    } catch (err) {
      context.log.error('Error loading database.json:', err.message);
      return {
        status: 500,
        body: 'Failed to load or parse database.json',
      };
    }

    // Look up stats for the requested fileName
    const stats = dbJson[fileName];
    if (!stats) {
      return {
        status: 404,
        body: `No stats found for file: ${fileName}`,
      };
    }

    // Return the stats as JSON
    context.log(`Found stats for file: ${fileName}`, stats);
    return {
      status: 200,
      jsonBody: stats,
    };
  },
});