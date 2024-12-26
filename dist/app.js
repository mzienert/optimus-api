"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
try {
    const result = (0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../.env') });
    if (result.parsed) {
        console.log('Loaded environment variables from .env file');
    }
}
catch (error) {
    console.log('No .env file found, using process environment variables');
}
const PORT = parseInt(process.env.PORT || '3000', 10);
const AWS_REGION = process.env.AWS_REGION || 'us-west-1';
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;
if (!DYNAMODB_TABLE) {
    console.error('DYNAMODB_TABLE environment variable must be set');
    process.exit(1);
}
const hyper_express_1 = __importDefault(require("hyper-express"));
const CoinbaseWebSocket_1 = require("./websocket/CoinbaseWebSocket");
class App {
    constructor(port) {
        this.isStarted = false;
        this.server = new hyper_express_1.default.Server();
        this.port = port;
        this.wsClient = CoinbaseWebSocket_1.CoinbaseWebSocket.getInstance();
        this.initializeRoutes();
    }
    static getInstance(port = PORT) {
        if (!App.instance) {
            App.instance = new App(port);
        }
        return App.instance;
    }
    initializeRoutes() {
        this.server.get('/', async (_req, res) => {
            await res.send('Server is running!');
        });
        this.server.get('/hello', async (_req, res) => {
            const response = {
                message: 'Hello from HyperExpress!',
                timestamp: new Date().toISOString()
            };
            await res.json(response);
        });
        this.server.get('/ws-status', async (_req, res) => {
            await res.json({
                status: 'WebSocket connection active',
                timestamp: new Date().toISOString(),
                config: {
                    port: this.port,
                    region: AWS_REGION,
                    environment: process.env.NODE_ENV
                }
            });
        });
        this.server.set_error_handler((_req, res, error) => {
            console.error('Error:', error);
            return res.status(500).json({
                status: 500,
                message: 'Internal Server Error'
            });
        });
        this.server.set_not_found_handler((req, res) => {
            return res.status(404).json({
                status: 404,
                message: 'Route not found',
                path: req.path
            });
        });
    }
    async start() {
        if (this.isStarted) {
            console.log('Server is already running');
            return;
        }
        try {
            await this.server.listen(this.port);
            console.log(`Server is running at http://localhost:${this.port} in ${process.env.NODE_ENV || 'development'} mode`);
            console.log(`Region: ${AWS_REGION}, DynamoDB Table: ${DYNAMODB_TABLE}`);
            console.log(`Try: http://localhost:${this.port}/hello`);
            await this.wsClient.connect();
            console.log('WebSocket client initialized');
            this.isStarted = true;
        }
        catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
    async stop() {
        if (!this.isStarted) {
            return;
        }
        try {
            this.wsClient.disconnect();
            console.log('WebSocket connection closed');
            await this.server.close();
            console.log('HTTP Server stopped');
            this.isStarted = false;
        }
        catch (error) {
            console.error('Error while stopping server:', error);
            process.exit(1);
        }
    }
}
App.instance = null;
const app = App.getInstance();
app.start();
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal, shutting down gracefully...');
    await app.stop();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('Received SIGINT signal, shutting down gracefully...');
    await app.stop();
    process.exit(0);
});
exports.default = App;
