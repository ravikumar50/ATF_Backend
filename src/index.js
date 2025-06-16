const { app } = require('@azure/functions');
const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential
} = require('@azure/storage-blob');

// Set up global config
app.setup({
  enableHttpStream: true,
});

// LIST BLOBS
app.http('listBlobs', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = 'dummyfiles';

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(containerName);

      let blobItems = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        const blobUrl = `${containerClient.url}/${blob.name}`;
        blobItems.push({ name: blob.name, url: blobUrl });
      }

      return {
        status: 200,
        jsonBody: blobItems,
      };
    } catch (error) {
      context.log('Error listing blobs:', error.message);
      return { status: 500, body: 'Error listing blobs' };
    }
  }
});

// UPLOAD BLOB
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

      // Allow browser view
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
      return { status: 500, body: 'Upload failed' };
    }
  }
});

// DOWNLOAD BLOB
app.http('downloadBlob', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const containerName = 'dummyfiles';

    const blobName = request.query.get('file');
    if (!blobName) {
      return { status: 400, body: 'Missing file name' };
    }

    try {
      context.log(`Generating SAS for blob: ${blobName}`);
      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
      const blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        sharedKeyCredential
      );

      const sas = generateBlobSASQueryParameters({
        containerName,
        blobName,
        expiresOn: new Date(Date.now() + 60 * 1000), // 1 minute
        permissions: BlobSASPermissions.parse('r'),
        protocol: SASProtocol.Https,
        contentDisposition: `attachment; filename="${blobName}"`,
      }, sharedKeyCredential).toString();

      const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sas}`;
      context.log(`Redirecting to: ${sasUrl}`);
      return {
        status: 302,
        headers: {
          Location: sasUrl
        }
      };
    } catch (error) {
      context.log("Download error:", error.message);
      return { status: 500, body: 'Error generating download link' };
    }
  }
});
