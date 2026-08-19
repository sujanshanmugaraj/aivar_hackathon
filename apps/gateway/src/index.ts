// Bootstrap entry point — loads .env BEFORE server.ts imports trigger config validation
// This file is intentionally separate so tsx can process it in CJS mode without ESM cycles

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

// Now safe to start the server
require('./server');
