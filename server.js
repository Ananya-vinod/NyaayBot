// Updated server.js for Indian Law AI Assistant

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Replace with your actual Gemini API key
const API_KEY = 'AIzaSyDohCJ_6I2A3ARseCs7zO1f6F0Q6WleWr8'; // You should use environment variables in production

// Routes - FIXED: Keep only one handler for the root path
app.get('/', (req, res) => {
  res.sendFile('landing.html', { root: './' });
});

app.get('/landing', (req, res) => {
  res.sendFile('landing.html', { root: './' });
});

app.get('/app', (req, res) => {
  res.sendFile('index.html', { root: './' });
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('./'));

// Enhanced logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve libraries locally for fallbacks
app.get('/libs/docx.js', (req, res) => {
  // Check if the file exists in node_modules (if installed via npm)
  const nodePath = path.join(__dirname, 'node_modules/docx/dist/docx.js');
  
  if (fs.existsSync(nodePath)) {
    return res.sendFile(nodePath);
  }
  
  // Fallback to locally saved copy (if you downloaded it manually)
  const localPath = path.join(__dirname, 'libs/docx.js');
  
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }
  
  // If no file is found, return an error
  res.status(404).json({
    error: 'Library not found',
    message: 'The docx.js library is not installed. Please run "npm install docx" to install it.'
  });
});

// Health check with API key validation
app.get('/api/health', async (req, res) => {
  try {
    // Use the correct Gemini 1.5 Flash endpoint
    const testResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: "Respond with only the word: Connected"
              }
            ]
          }
        ]
      },
      {
        params: { key: API_KEY },
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    console.log('Health check API response status:', testResponse.status);
    
    // Validate the response structure
    if (testResponse.data && 
        testResponse.data.candidates && 
        testResponse.data.candidates[0] && 
        testResponse.data.candidates[0].content && 
        testResponse.data.candidates[0].content.parts && 
        testResponse.data.candidates[0].content.parts[0]) {
      res.json({ 
        status: 'ok', 
        apiAccessible: true,
        libraries: {
          docx: fs.existsSync(path.join(__dirname, 'node_modules/docx')) || 
                fs.existsSync(path.join(__dirname, 'libs/docx.js'))
        }
      });
      console.log('API health check successful');
    } else {
      console.error('Invalid API response structure:', testResponse.data);
      res.json({ status: 'error', message: 'Invalid API response structure', apiAccessible: false });
    }
  } catch (error) {
    console.error('API health check failed:', error.message);
    console.error('API error details:', error.response?.data || 'No additional details');
    
    // Return more detailed error info for debugging
    res.json({ 
      status: 'error', 
      message: error.message,
      details: error.response?.data || 'No additional details',
      apiAccessible: false,
      libraries: {
        docx: fs.existsSync(path.join(__dirname, 'node_modules/docx')) || 
              fs.existsSync(path.join(__dirname, 'libs/docx.js'))
      }
    });
  }
});

// Check if libraries are installed
app.get('/api/libraries', (req, res) => {
  const libraries = {
    docx: fs.existsSync(path.join(__dirname, 'node_modules/docx')) || 
          fs.existsSync(path.join(__dirname, 'libs/docx.js')),
    jspdf: fs.existsSync(path.join(__dirname, 'node_modules/jspdf')) || 
           fs.existsSync(path.join(__dirname, 'libs/jspdf.umd.min.js')),
    html2canvas: fs.existsSync(path.join(__dirname, 'node_modules/html2canvas')) || 
                 fs.existsSync(path.join(__dirname, 'libs/html2canvas.min.js'))
  };
  
  res.json({ 
    status: 'ok',
    libraries,
    missingLibraries: Object.keys(libraries).filter(lib => !libraries[lib])
  });
});

// Gemini API proxy endpoint with enhanced error handling
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, temperature = 0.2, maxOutputTokens = 1024 } = req.body;
    
    console.log('Processing Gemini API request:', prompt.substring(0, 50) + '...');
    
    // FIXED: Added enhanced prompt for Indian law assistant
    const enhancedPrompt = `You are an AI assistant specializing in Indian law. Provide helpful, accurate information about Indian legal matters in a clear, professional manner. Always cite relevant sections of laws or precedents when applicable. Remember that you're providing general information, not legal advice.

When appropriate, use **bold** for important terms, *italics* for emphasis, and cite relevant laws, sections, or cases. Format your response clearly with headings and lists where appropriate.

${prompt}`;
    
    // Use the correct Gemini 1.5 Flash endpoint
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: enhancedPrompt // Using the enhanced prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxOutputTokens,
          topP: 0.8,
          topK: 40
        }
      },
      {
        params: { key: API_KEY },
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    console.log('Gemini API response received successfully');
    res.json(response.data);
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    
    if (error.response) {
      console.error('API error status:', error.response.status);
      console.error('API error details:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Enhanced error reporting
    const errorResponse = {
      error: 'Failed to process request',
      message: error.message
    };
    
    // Add detailed API error information if available
    if (error.response) {
      errorResponse.status = error.response.status;
      errorResponse.statusText = error.response.statusText;
      errorResponse.details = error.response.data;
    }
    
    res.status(500).json(errorResponse);
  }
});

// REMOVED: Duplicate root handler

// Endpoint to install missing library
app.post('/api/install-library', async (req, res) => {
  const { library } = req.body;
  
  if (!library) {
    return res.status(400).json({
      error: 'Missing library name',
      message: 'Please provide a library name to install'
    });
  }
  
  // Security check - only allow known libraries
  const allowedLibraries = ['docx', 'jspdf', 'html2canvas'];
  if (!allowedLibraries.includes(library)) {
    return res.status(400).json({
      error: 'Invalid library',
      message: `Library ${library} is not in the allowed list: ${allowedLibraries.join(', ')}`
    });
  }
  
  try {
    // This would require more setup in a production environment
    // Here we're just showing a placeholder for installing the library
    console.log(`Installing library: ${library}`);
    
    // For security reasons, we don't actually run npm install from an API endpoint
    // Instead, provide instructions to the user
    res.json({
      status: 'info',
      message: `For security reasons, please install ${library} manually by running: npm install ${library}`,
      instructions: `Run the following command in your terminal:\nnpm install ${library}`
    });
  } catch (error) {
    console.error(`Error installing library ${library}:`, error);
    res.status(500).json({
      error: 'Installation failed',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `The resource at ${req.originalUrl} was not found`
  });
});

// Show startup configuration for debugging
app.listen(port, () => {
  console.log(`======================================`);
  // UPDATED: Changed server name in console log
  console.log(`Indian Law AI Server running at http://localhost:${port}`);
  console.log(`API Key: ${API_KEY.substring(0, 6)}...${API_KEY.substring(API_KEY.length-4)}`);
  console.log(`Model: Gemini 1.5 Flash`);
  
  // Check for required libraries
  const docxInstalled = fs.existsSync(path.join(__dirname, 'node_modules/docx')) || 
                        fs.existsSync(path.join(__dirname, 'libs/docx.js'));
  console.log(`Docx library installed: ${docxInstalled ? 'Yes' : 'No - run "npm install docx"'}`);
  
  console.log(`======================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});