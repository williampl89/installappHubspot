const express = require('express');
const router = express.Router();
const axios = require('axios');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// ✅ RUTA 1: Webhook que recibe mensajes de Instagram
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'page') {
      for (const entry of body.entry) {
        const messagingEvents = entry.messaging;

        for (const event of messagingEvents) {
          if (event.message && event.message.text) {
            const senderId = event.sender.id;
            const messageText = event.message.text;
            const timestamp = event.timestamp;
            const messageId = event.message.mid;

            await sendMessageToHubSpot({
              senderId,
              messageText,
              timestamp,
              messageId
            });
          }
        }
      }

      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('❌ Error en webhook Instagram:', error.message);
    res.status(500).send('Error interno');
  }
});

// ✅ RUTA 2: Validación del Webhook de Instagram por parte de Meta
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


router.get('/incoming-from-hubspot', (req, res) => {
    res.status(200).send('Webhook url test ok');
});

// ✅ RUTA 3: Webhook receptor de mensajes salientes desde HubSpot
router.post('/incoming-from-hubspot', async (req, res) => {
  try {
    const body = req.body;
    const recipientId = body.recipient.id;
    const messageText = body.message.text;

    await sendMessageToInstagram(recipientId, messageText);

    res.status(200).send('Mensaje enviado a Instagram');
  } catch (error) {
    console.error('❌ Error enviando a Instagram:', error.response?.data || error.message);
    res.status(500).send('Error al reenviar a Instagram');
  }
});

// 🔁 ENVÍA mensaje entrante a HubSpot
async function sendMessageToHubSpot({ senderId, messageText, timestamp, messageId }) {
  const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;

  const payload = {
    channelAccount: {
      id: senderId
    },
    message: {
      text: messageText,
      type: 'STANDARD'
    },
    createdAt: timestamp,
    externalMessageId: messageId,
    recipient: {
      id: 'admin'
    }
  };

  try {
    const response = await axios.post(
      'https://api.hubapi.com/conversations/v3/messages/inbound',
      payload,
      {
        headers: {
          Authorization: `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📤 Enviado a HubSpot:', response.data);
  } catch (err) {
    console.error('❌ Error al enviar a HubSpot:', err.response?.data || err.message);
  }
}

// 🔁 ENVÍA mensaje saliente a Instagram
async function sendMessageToInstagram(psid, text) {
  const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

  const payload = {
    recipient: { id: psid },
    message: { text: text },
    messaging_type: 'RESPONSE'
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`,
      payload
    );
    console.log('📤 Enviado a Instagram:', response.data);
  } catch (error) {
    console.error('❌ Error enviando a Instagram:', error.response?.data || error.message);
    throw error;
  }
}


module.exports = router;