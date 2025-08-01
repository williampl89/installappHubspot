require('dotenv').config();
const request = require('request-promise-native');
const NodeCache = require('node-cache');

const refreshTokenStore = {};
const accessTokenCache = new NodeCache({ deleteOnExpire: true });

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
let SCOPES = ['crm.objects.contacts.read'];
if (process.env.SCOPE) {
  SCOPES = (process.env.SCOPE.split(/ |, ?|%20/)).join(' ');
}

const exchangeForTokens = async (userId, exchangeProof) => {
  try {
    const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
      form: exchangeProof
    });
    const tokens = JSON.parse(responseBody);
    refreshTokenStore[userId] = tokens.refresh_token;
    accessTokenCache.set(userId, tokens.access_token, Math.round(tokens.expires_in * 0.75));
    return tokens.access_token;
  } catch (e) {
    console.error(`Error exchanging ${exchangeProof.grant_type} for access token`);
    return JSON.parse(e.response.body);
  }
};

const refreshAccessToken = async (userId) => {
  const refreshTokenProof = {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: `http://localhost:${process.env.PORT || 3000}/oauth-callback`,
    refresh_token: refreshTokenStore[userId]
  };
  return await exchangeForTokens(userId, refreshTokenProof);
};

const getAccessToken = async (userId) => {
  if (!accessTokenCache.get(userId)) {
    console.log('Refreshing expired access token');
    await refreshAccessToken(userId);
  }
  return accessTokenCache.get(userId);
};

const isAuthorized = (userId) => {
  return refreshTokenStore[userId] ? true : false;
};

const setupRoutes = () => {
  const router = require('express').Router();
  const REDIRECT_URI = `http://localhost:${process.env.PORT || 3000}/oauth-callback`;

  const authUrl =
    'https://app.hubspot.com/oauth/authorize' +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  router.get('/install', (req, res) => {
    console.log('Initiating OAuth 2.0 flow with HubSpot');
    res.redirect(authUrl);
  });

  router.get('/oauth-callback', async (req, res) => {
    if (req.query.code) {
      const authCodeProof = {
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code: req.query.code
      };

      const token = await exchangeForTokens(req.sessionID, authCodeProof);
      if (token.message) {
        return res.redirect(`/error?msg=${token.message}`);
      }
      res.redirect(`/`);
    }
  });

  router.get('/', async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.write(`<h2>HubSpot OAuth 2.0 Quickstart App</h2>`);
    if (isAuthorized(req.sessionID)) {
      const accessToken = await getAccessToken(req.sessionID);
      const refreshToken = await refreshAccessToken(req.sessionID);

      res.write(`<h4>Access token: ${accessToken}</h4><h4>Refresh token: ${refreshToken}</h4>`);
    } else {
      res.write(`<a href="/install"><h3>Install the app</h3></a>`);
    }
    res.end();
  });

  return router;
};

module.exports = {
  exchangeForTokens,
  refreshAccessToken,
  getAccessToken,
  isAuthorized,
  setupRoutes
};