import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load .env file, but don't fail if it doesn't exist
try {
    const result = config({ path: resolve(__dirname, '../.env') });
    if (result.parsed) {
        console.log('Loaded environment variables from .env file');
    }
} catch (error) {
    console.log('No .env file found, using process environment variables');
}

// Parse PORT to number and provide fallback
const PORT = parseInt(process.env.PORT || '3000', 10);
const AWS_REGION = process.env.AWS_REGION || 'us-west-1';
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;

if (!DYNAMODB_TABLE) {
    console.error('DYNAMODB_TABLE environment variable must be set');
    process.exit(1);
}

import HyperExpress from 'hyper-express';
import { CoinbaseWebSocket } from './websocket/CoinbaseWebSocket';

interface HelloResponse {
    message: string;
    timestamp: string;
}

class App {
    private static instance: App | null = null;
    private server: HyperExpress.Server;
    private readonly port: number;
    private wsClient: CoinbaseWebSocket;
    private isStarted: boolean = false;

    private constructor(port: number) {
        this.server = new HyperExpress.Server();
        this.port = port;
        this.wsClient = CoinbaseWebSocket.getInstance();
        this.initializeRoutes();
    }

    public static getInstance(port: number = PORT): App {
        if (!App.instance) {
            App.instance = new App(port);
        }
        return App.instance;
    }

    private initializeRoutes(): void {
        this.server.get('/', async (_req: HyperExpress.Request, res: HyperExpress.Response) => {
            await res.send('Server is running!');
        });

        this.server.get('/hello', async (_req: HyperExpress.Request, res: HyperExpress.Response) => {
            const response: HelloResponse = {
                message: 'Hello from HyperExpress!',
                timestamp: new Date().toISOString()
            };
            
            await res.json(response);
        });

        this.server.get('/ws-status', async (_req: HyperExpress.Request, res: HyperExpress.Response) => {
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

    public async start(): Promise<void> {
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
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    public async stop(): Promise<void> {
        if (!this.isStarted) {
            return;
        }

        try {
            this.wsClient.disconnect();
            console.log('WebSocket connection closed');

            await this.server.close();
            console.log('HTTP Server stopped');
            
            this.isStarted = false;
        } catch (error) {
            console.error('Error while stopping server:', error);
            process.exit(1);
        }
    }
}

// Get the singleton instance and start it
const app = App.getInstance();
app.start();

// Handle graceful shutdown
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

export default App;