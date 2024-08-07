const axios = require('axios');
const { logError } = require('../function/logError')

const skyport = {
    url: process.env.SKYPORT_URL,
    key: process.env.SKYPORT_KEY
};

// Figure out how what the user's total resource usage is right now
async function calculateResource(userID, resource) {
    try {
      console.log("Starting resource calculation for user:", userID);
  
      const response = await axios.post(`${skyport.url}/api/getUserInstance`, {
        userId: userID
      }, {
        headers: {
          'x-api-key': skyport.key,
          'Content-Type': 'application/json'
        }
      });
  
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response data format');
      }
  
      // Calculate total resources
      let totalResources = 0;
      response.data.forEach(server => {
        if (server[resource] !== undefined) {
          let resourceValue = server[resource];
          if (resource === 'Cpu') {
            resourceValue *= 100;
          }
          totalResources += resourceValue;
        } else {
          console.warn(`Resource ${resource} not found in server data`, server);
        }
      });
  
      return totalResources;
    } catch (err) {
      // Log errors to a file
      const errorMessage = `[LOG] Failed to calculate resources for user ${userID}. Error: ${err.message}\n`;
      logError('Failed to calculate resources for user', errorMessage);
      throw err;
    }
}

module.exports = { calculateResource };