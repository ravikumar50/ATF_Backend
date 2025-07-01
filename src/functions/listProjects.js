const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");

app.http('listProjects', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const formData = await request.formData();
            const email = formData.get('email');

            if (!email) {
                return { status: 400, body: "Email is required" };
            }

            const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient("projectmetadata");

            // Fetch mapping.json
            const mapping = await fetchJsonFromBlob(containerClient, "mapping.json");
            if (!mapping[email]) {
                return { status: 404, body: "No projects found for this email" };
            }
            // console.log("Mapping for email:", mapping[email]);
            const projectNames = Array.isArray(mapping[email]) ? mapping[email] : [mapping[email]];
            // console.log("Project names:", projectNames);

            // Fetch database.json
            const database = await fetchJsonFromBlob(containerClient, "database.json");

            // Filter project details
            // console.log(database.data);
            // console.log("Project names to filter:", projectNames);
            console.log("Database data:", database.data);
            if(projectNames[0] == 'Admin'){
                context.res = { status: 200, headers: {"Content-Type": "application/json"}, jsonBody: database.data };
            }
            const projectDetails = database.data.filter(project => projectNames.includes(project.name));
            // console.log("Filtered project details:", database);
            if (projectDetails.length === 0) {
                context.res = { status: 404, headers: {"Content-Type": "application/json"}, jsonBody: "No project details found for this email" };
            }
            // console.log("Filtered project details:", projectDetails);
            context.res = {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: projectDetails
            };

        } catch (error) {
            console.error("Error in listProjects handler:", error);
            return { status: 500, jsonBody: "An unexpected error occurred" };
        }
    }
});


async function fetchJsonFromBlob(containerClient, blobName) {
    try {
        const blobClient = containerClient.getBlobClient(blobName);
        const downloadResponse = await blobClient.download();
        const content = await streamToString(downloadResponse.readableStreamBody);
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error fetching or parsing blob ${blobName}:`, error);
        throw new Error(`Failed to fetch or parse ${blobName}`);
    }
}


async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (chunk) => chunks.push(chunk));
        readableStream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        readableStream.on("error", reject);
    });
}