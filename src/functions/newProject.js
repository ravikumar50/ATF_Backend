const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
app.http('newProject', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

        try {
            //  ------------ creating a new container ------------
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const containerName = request.body.name || "new-container"; 
            const description = request.body.description || "No description provided";
            // const containerName = `container-${Date.now()}`;
            // const description = request.query.description || "No description provided";
            const containerClient = blobServiceClient.getContainerClient(containerName);

            await containerClient.create();
            context.res = {
                status: 200,
                body: { containerName },
            };
            // ---------------- creating folder-like structure ----------------
            const folderName = "dummyfiles/";
            const blockBlobClient = containerClient.getBlockBlobClient(folderName);

            // Create an empty blob for the folder-like structure
            await blockBlobClient.upload("", 0);

            const folderName2 = "metadata/";
            const blockBlobClient2 = containerClient.getBlockBlobClient(`${folderName2}database.json`);

            const database = {
                About: {
                    name: containerName,
                    description: "This is a new project container created for testing purposes.",
                    createdAt: new Date().toISOString(),
                },
                Overall: {
                    total: 0,
                    executed: 0,
                    passed: 0,
                    failed: 0,
                    skipped: 0,
                    error: 0,
                    timeout: 0,
                    aborted: 0,
                    inconclusive: 0,
                    passedButRunAborted: 0,
                    notRunnable: 0,
                    disconnected: 0,
                    warning: 0,
                    completed: 0,
                    inProgress: 0,
                    pending: 0,
                },
            };

            // Convert the `database` object to a JSON string
            const databaseContent = JSON.stringify(database, null, 2);

            // Upload the JSON content as a blob
            await blockBlobClient2.upload(databaseContent, Buffer.byteLength(databaseContent), {
                blobHTTPHeaders: { blobContentType: "application/json" }, // Set the content type to JSON
            });

            const metadataBlobClient = blobServiceClient.getContainerClient("projectmetadata").getBlockBlobClient("database.json");

            // Step 1: Download the existing `database.json`
            const downloadResponse = await metadataBlobClient.download();
            const downloadedContent = await streamToString(downloadResponse.readableStreamBody);

            // Parse the downloaded content as JSON
            const databaseJson = JSON.parse(downloadedContent);
            // console.log(databaseJson);
            // Step 2: Add a new entry to the `data` array
            const newEntry = {
                name: containerName,
                description: description,
            };

            databaseJson.data.push(newEntry);

            // Step 3: Serialize the updated JSON
            const updatedContent = JSON.stringify(databaseJson, null, 2);

            // Step 4: Upload the updated JSON back to Azure Blob Storage
            await metadataBlobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
                blobHTTPHeaders: { blobContentType: "application/json" }, // Set the content type to JSON
            });

            // Helper function to convert stream to string
            async function streamToString(readableStream) {
                return new Promise((resolve, reject) => {
                    const chunks = [];
                    readableStream.on("data", (chunk) => chunks.push(chunk));
                    readableStream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
                    readableStream.on("error", reject);
                });
            }

            return {
                status: 200,
                body: { message: `Container ${containerName} created successfully` },
            };
        } catch (error) {
            context.log("Error creating container:", error.message);
            context.res = {
                status: 500,
                body: { error: error.message },
            };
            return {
                status: 500,
                body: { error: 'Failed to create new project container' },
            };
        }
    }
});
