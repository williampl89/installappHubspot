const express = require('express');
const router = express.Router();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

router.post('/', (req, res) => {
  let body = req.body;
  console.log('Received webhook:', body);
  res.status(200).send(`Received webhook`);
});

// Ruta para validar el Webhook (Meta requiere esta validación)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  } 
});

module.exports = router;