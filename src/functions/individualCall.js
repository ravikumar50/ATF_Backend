
const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { XMLParser } = require('fast-xml-parser');

// Safely parse attribute string to integer
const toInt = (val) => (val != null && !isNaN(val) ? parseInt(val, 10) : 0);

app.http('individualCall', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // Retrieve filename from route parameters
    const ulr = new URL(request.url);
    const filename = ulr.searchParams.get('filename');
    // const filename = request.params.filename;
    if (!filename) {
      return { status: 400, body: 'Missing route parameter `filename`' };
    }
    context.log(`Looking up stats for file: ${filename}`);

    // Ensure storage connection string is set
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) {
      return { status: 500, body: 'Missing AZURE_STORAGE_CONNECTION_STRING' };
    }

    // Initialize blob client for database.json
    const containerClient = BlobServiceClient
      .fromConnectionString(connStr)
      .getContainerClient('metadata');
    const dbBlobClient = containerClient.getBlobClient('database.json');

    let dbJson;
    try {
      // Download database.json to buffer and parse JSON
      const buffer = await dbBlobClient.downloadToBuffer();
      dbJson = JSON.parse(buffer.toString('utf-8'));
    } catch (err) {
      context.log.error('Error fetching or parsing database.json:', err.message);
      return { status: 500, body: 'Failed to load database.json' };
    }

    // Look up the stats for the requested filename
    const stats = dbJson[filename];
    if (!stats) {
      return { status: 404, body: `No stats found for file: ${filename}` };
    }

    // Return the stats as JSON
    context.log(`Found stats for file: ${filename}`, stats);
    return {
        status: 200,
        jsonBody:stats,
    };
  }
});
