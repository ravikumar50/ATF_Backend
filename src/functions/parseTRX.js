const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { XMLParser } = require('fast-xml-parser');

app.http('parseTrx', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

    const url = new URL(request.url);
    const containerName = url.searchParams.get('containerName');
    const fileName = url.searchParams.get('filename');

    context.log('Received request to parse TRX file:', fileName);
    context.log('Container Name:', containerName);

    if (!containerName || !fileName) {
      return {
        status: 400,
        body: 'Missing containerName or filename parameter',
      };
    }

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(containerName);

      const blobPath = `dummyfiles/${fileName}`;
      const blobClient = containerClient.getBlobClient(blobPath);

      context.log(`Checking blob at path: ${blobPath} in container: ${containerName}`);

      const exists = await blobClient.exists();
      if (!exists) {
        context.log(`Blob does NOT exist: ${blobPath}`);
        return {
          status: 404,
          body: `Blob not found at path dummyfiles/${fileName} in container ${containerName}`,
        };
      }

      const downloadResponse = await blobClient.download();
      const xmlContent = await streamToString(downloadResponse.readableStreamBody);

      const parser = new XMLParser({ ignoreAttributes: false });
      const jsonObj = parser.parse(xmlContent);

      const counters = jsonObj?.TestRun?.ResultSummary?.Counters;
      if (!counters || typeof counters !== 'object') {
        return {
          status: 404,
          body: 'Counters not found in TRX file',
        };
      }

      const currDate = new Date();
      const expiryDate = new Date(currDate.getTime() + 2 * 60 * 1000); // 2 minutes from now

      const parsedCounts = {
        total: parseInt(counters['@_total'] || '0', 10),
        executed: parseInt(counters['@_executed'] || '0', 10),
        passed: parseInt(counters['@_passed'] || '0', 10),
        failed: parseInt(counters['@_failed'] || '0', 10),
        skipped: parseInt(counters['@_notExecuted'] || '0', 10),
        error: parseInt(counters['@_error'] || '0', 10),
        timeout: parseInt(counters['@_timeout'] || '0', 10),
        aborted: parseInt(counters['@_aborted'] || '0', 10),
        inconclusive: parseInt(counters['@_inconclusive'] || '0', 10),
        passedButRunAborted: parseInt(counters['@_passedButRunAborted'] || '0', 10),
        notRunnable: parseInt(counters['@_notRunnable'] || '0', 10),
        disconnected: parseInt(counters['@_disconnected'] || '0', 10),
        warning: parseInt(counters['@_warning'] || '0', 10),
        completed: parseInt(counters['@_completed'] || '0', 10),
        inProgress: parseInt(counters['@_inProgress'] || '0', 10),
        pending: parseInt(counters['@_pending'] || '0', 10),
        expiryDate: expiryDate.toISOString(),
      };

      return {
        status: 200,
        jsonBody: parsedCounts,
      };

    } catch (error) {
      context.log('Error parsing TRX:', error.message);
      return {
        status: 500,
        body: 'Failed to parse TRX file',
      };
    }
  }
});

async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}
