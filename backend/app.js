const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid'); // For generating GUIDs
const app = express();
const fs = require('fs');
const path = require('path');

// Function to ensure the data directory exists
function ensureDataDirectoryExists() {
  const dataPath = path.join(__dirname, 'data');
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
}

function saveDataToFile(guid, data) {
  ensureDataDirectoryExists(); // Ensure directory exists before writing
  const filePath = path.join(__dirname, 'data', `${guid}.txt`);
  fs.writeFileSync(filePath, JSON.stringify(data));
}
// Use bodyParser middleware to parse JSON bodies
app.use(bodyParser.json());

// In-memory data store for demonstration
const dataStore = {};

function isValidGuid(guid) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guid);
}

function readDataFromFile(guid) {
  const filePath = path.join(__dirname, 'data', `${guid}.txt`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } else {
    return null; // Or handle the error as preferred
  }
}


// API to store data and respond with a GUID
app.get('/api/getcid', (req, res) => {
  const firstSocketData = req.query.params;
  const guid = uuidv4();
  dataStore[guid] = { data: firstSocketData, timestamp: new Date() };
  saveDataToFile(guid, dataStore[guid]); // Save to file
  res.json({ guid });
});

// API to retrieve parameters by GUID
app.get('/api/getparams', (req, res) => {
  const { cid } = req.query;
  if (!isValidGuid(cid)) {
    res.status(400).send({ message: "Invalid GUID format" });
    return;
  }
  const data = readDataFromFile(cid);
  if (!data) {
    res.status(404).send({ message: "Record not found or expired" });
    return;
  }

  res.json({ socketData: data.data });
});


// Catch all for any other requests
app.use((req, res) => {
  res.status(404).send('Resource not found');
});

module.exports = app;
