'use strict';

const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

let swaggerDocument;
try {
  swaggerDocument = yaml.load(
    fs.readFileSync(path.join(__dirname, '../docs/openapi.yaml'), 'utf8')
  );
} catch (e) {
  console.error('[swagger] Impossible de charger docs/openapi.yaml :', e.message);
  swaggerDocument = { openapi: '3.1.0', info: { title: 'Gestion-Truffiere API', version: '8.0.0' }, paths: {} };
}

const swaggerOptions = {
  customSiteTitle: 'Gestion-Truffiere API Docs',
  customCss: '.swagger-ui .topbar { background-color: #01696f; }',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: false, // désactivé par défaut — ne jamais tester en prod
  },
};

module.exports = { swaggerUi, swaggerDocument, swaggerOptions };
