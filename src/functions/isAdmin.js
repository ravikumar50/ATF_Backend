const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");

app.http('isAdmin', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    // const formData = await request.formData();
    // let email = formData.get('email');
    // console.log(email);
    
    try {
        const formData = await request.formData();
      let email = formData.get('email');
      console.log(email)
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient("projectmetadata");
      const mapping = await fetchJsonFromBlob(containerClient, "mapping.json");
      
       if (!mapping[email]) {
        return { status: 404, body: "No projects found for this email" };
      }

      const projectNames = Array.isArray(mapping[email]) ? mapping[email] : [mapping[email]];

      if(projectNames[0] === 'Admin') {
        return {
          status: 200,
         
        };
      }
      else {
        return {
            status: 403,
        }
      }

      

    } catch (error) {
      console.error("Error checking admin status:", error);
      return {
        status: 500,
        body: 'Error checking admin status'
      };
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
