require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const OAuth2Server = require('oauth2-server');
const { Request, Response } = OAuth2Server;



const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
/* ------------------------------------------------------------------ *
 * In-memory data store (replace with DB in production)
 * ------------------------------------------------------------------ */
const employees = [
  { id: 1, name: 'Alice Ahmed', jobTitle: 'Backend Engineer' },
  { id: 2, name: 'Bruno Briones', jobTitle: 'Product Manager' },
  { id: 3, name: 'Chloe Chang', jobTitle: 'Data Scientist' },
];

const clients = [
  {
    id: 'hr-dashboard',                   // client_id
    redirectUris: [],
    grants: ['client_credentials'],
    accessTokenLifetime: 60 * 60,         // 1 hour
    clientSecret: process.env.CLIENT_SECRET || 'super-secret',
  },
];

/* ------------------------------------------------------------------ *
 * Minimal model implementation required by oauth2-server
 * ------------------------------------------------------------------ */
const accessTokenStore = new Map();

const oauthModel = {
  getClient: async (clientId, clientSecret) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    if (clientSecret && client.clientSecret !== clientSecret) return null;
    return {
      id: client.id,
      grants: client.grants,
      accessTokenLifetime: client.accessTokenLifetime,
    };
  },

  saveToken: async (token, client) => {
    const fullToken = {
      ...token,
      client: { id: client.id },
      user: {},                         // No user in client_credentials flow
    };
    accessTokenStore.set(token.accessToken, fullToken);
    return fullToken;
  },

  getAccessToken: async (accessToken) => {
    return accessTokenStore.get(accessToken) || null;
  },

  getUserFromClient: async (client) => {
    return {};
  }
};

const oauth = new OAuth2Server({
  model: oauthModel,
  allowBearerTokensInQueryString: false,
});

/* ---------- Token endpoint (client_credentials) ---------- */
app.post('/oauth/token', (req, res, next) => {
  const request = new Request(req);
  const response = new Response(res);

  oauth
    .token(request, response, { requireClientAuthentication: { client_credentials: true } })
    .then(token => {
      res.set(response.headers);
      res.status(response.status).json(token);
    })
    .catch(err => {
      res.status(err.code || 500).json({
        error: err.name,
        message: err.message
      });
    });
});

/* ---------- Protected employees endpoint ---------- */
const authenticate = (req, res, next) => {
  const request = new Request(req);
  const response = new Response(res);

  oauth
    .authenticate(request, response)
    .then(() => next())
    .catch(err => {
      res.status(err.code || 401).json({
        error: err.name,
        message: err.message
      });
    });
};

app.get('/employees', authenticate, (req, res) => {
  res.json(employees);
});

/* ------------------------------------------------------------------ *
 * Start server
 * ------------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OAuth API listening on http://localhost:${PORT}`);
});
