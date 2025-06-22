const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { XMLParser } = require('fast-xml-parser');

app.storageBlob('parseTrxOnUpload', {
  path: 'dummyfiles/{name}',
  connection: process.env.AZURE_STORAGE_CONNECTION_STRING,
  handler: async (blob, context) => {
    const fileName = context.triggerMetadata.name;
    context.log(`Processing blob "${fileName}"`);

    try {
      const parser = new XMLParser({ ignoreAttributes: false });
      const jsonObj = parser.parse(blob.toString());

      const counters = jsonObj?.TestRun?.ResultSummary?.Counters;

      if (!counters || typeof counters !== 'object') {
        context.log.warn('Counters not found in TRX file');
        return;
      }

      const parsedCounts = {
        fileName,
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
      };

      // Upload to metadata container
      const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
      const metadataContainerName = 'metadata';
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(metadataContainerName);
      const metadataBlob = containerClient.getBlockBlobClient('parsedResults.json');

    let parsedResults = [];
    try {
    const downloadResponse = await metadataBlob.download();
    const existing = await streamToString(downloadResponse.readableStreamBody);
    parsedResults = JSON.parse(existing);
    } catch (e) {
    context.log('parsedResults.json does not exist yet or is empty.');
    }

    // Filter out existing entry for this file and the 'overAll' entry
    parsedResults = parsedResults.filter(item => item.fileName !== fileName && item.fileName !== 'overAll');

    // Add/replace current parsed result
    parsedResults.push(parsedCounts);

    // Calculate overall aggregate
    const aggregate = {
    fileName: 'overAll',
    };

    const keys = Object.keys(parsedCounts).filter(key => key !== 'fileName');
    for (const key of keys) {
    aggregate[key] = parsedResults.reduce((sum, item) => sum + (item[key] || 0), 0);
    }

    // Final list with overAll at the top
    const finalResults = [aggregate, ...parsedResults];

    await metadataBlob.uploadData(Buffer.from(JSON.stringify(finalResults, null, 2)), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    overwrite: true,
    });

    context.log(`Successfully stored parsed results and updated overall for ${fileName}`);
    } catch (error) {
      context.log.error('Error parsing or saving TRX file:', error.message);
    }
  },
});

async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}
