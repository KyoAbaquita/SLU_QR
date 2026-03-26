// Entry point for Vercel serverless deployment
// Vercel reads environment variables automatically from the dashboard,
// but we still call dotenv so it works locally too.
try { require('dotenv').config(); } catch (e) {}
const app = require('../server.js');
module.exports = app;
