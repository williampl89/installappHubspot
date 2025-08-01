require('dotenv').config();
const express = require('express');
const session = require('express-session');
const opn = require('open');
const webhookRoutes = require('./router/webhook');
const hubspotService = require('./services/hubspot');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use(session({
  secret: Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized: true
}));

// Configuración de HubSpot
app.use('/', hubspotService.setupRoutes());

// Rutas de webhook
app.use('/webhook', webhookRoutes);

app.get('/error', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h4>Error: ${req.query.msg}</h4>`);
  res.end();
});

app.listen(PORT, () => {
  console.log(`=== Starting your app on http://localhost:${PORT} ===`);
  if (process.env.NODE_ENV !== 'production') {
    opn(`http://localhost:${PORT}`);
  }
});