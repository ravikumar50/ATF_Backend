const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.timer('selfDestruct', {
    // schedule: '0 0 6 * * *',
    schedule: '0 */3 * * * *', // Every 30 minutes

    handler: async (myTimer, context) => {
        const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);

        // List all containers in the storage account
        for await (const container of blobServiceClient.listContainers()) {
            const containerName = container.name;
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const dbBlobClient = containerClient.getBlockBlobClient('metadata/database.json');

            let dbJson;
            try {
                const buffer = await dbBlobClient.downloadToBuffer();
                dbJson = JSON.parse(buffer.toString('utf-8'));
            } catch (err) {
                console.log(`No database.json found in container: ${containerName}, skipping.`);
                continue; // Skip containers without database.json
            }

            for (const [fileName, stats] of Object.entries(dbJson)) {
                if (fileName === "Overall" || fileName === "About") continue;

                if (stats.expiryDate) {
                    const expiryDate = new Date(stats.expiryDate);
                    const currentDate = new Date();
                    if (expiryDate < currentDate) {
                        const formData = new FormData();
                        formData.append("containerName", containerName);
                        formData.append("filename", fileName);
                        
                        const url = "https://functionapptry.azurewebsites.net/api/deleteBlob"; // Deployed
                        await fetch(url, {
                            method: 'DELETE',
                            body: formData
                        });

                        // // Remove from database.json
                        // delete dbJson[fileName];

                        // // Save updated database.json after deletions
                        // try {
                        //     const updatedContent = Buffer.from(JSON.stringify(dbJson, null, 2), 'utf-8');
                        //     await dbBlobClient.uploadData(updatedContent, { overwrite: true });
                        //     console.log(`Updated database.json uploaded successfully in ${containerName}.`);
                        // } catch (uploadErr) {
                        //     console.log(`Failed to upload updated database.json in ${containerName}:`, uploadErr.message);
                        // }
                    }
                }
            }

        }
    }
});
