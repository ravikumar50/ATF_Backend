const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.timer('selfDestruct', {
    schedule: '0 30 9 * * *',
    handler:async (myTimer, context) => {
        // context.log('Timer function processed request.');
        const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerClient = BlobServiceClient.fromConnectionString(connStr).getContainerClient('metadata');
        const dbBlobClient = containerClient.getBlobClient('database.json');

        let dbJson;
        try {
            const buffer = await dbBlobClient.downloadToBuffer();
            dbJson = JSON.parse(buffer.toString('utf-8'));
        } 
        catch (err) {
            context.log.error('Error loading database.json:', err.message);
            return {
                status: 500,
                body: 'Failed to load or parse database.json',
            };
        }
        // console.log('Database JSON loaded successfully:', dbJson);
        // 2025-09-24T12:44:55.277Z
        for (const [fileName, stats] of Object.entries(dbJson)) {
            if (stats.expiryDate) {
                const expiryDate = new Date(stats.expiryDate);
                const currentDate = new Date();
                if(expiryDate < currentDate) {
                    context.log(`Deleting expired file: ${fileName}`);
                    // Delete the file from dummyfiles container
                    const dummyContainer = BlobServiceClient.fromConnectionString(connStr).getContainerClient('dummyfiles');
                    const res = await fetch(
                        `https://functionapptry.azurewebsites.net/api/deleteBlob?filename=${fileName}`,
                        { method: "DELETE" }
                      );

                    // Remove from database.json
                    delete dbJson[fileName];
                }
            }
        }
    }
});
