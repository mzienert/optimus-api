"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KlineService = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
class KlineService {
    constructor() {
        const dynamoDbClient = new client_dynamodb_1.DynamoDBClient({
            region: process.env.AWS_REGION || 'us-west-1'
        });
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoDbClient);
        const tableName = process.env.DYNAMODB_TABLE;
        if (!tableName) {
            throw new Error('DYNAMODB_TABLE environment variable must be set');
        }
        this.tableName = tableName;
    }
    createPrimaryKey(exchange, symbol) {
        return `KLine#${exchange}#${symbol}`;
    }
    async saveKline(kline) {
        if (!this.tableName) {
            throw new Error('DynamoDB table name is not configured');
        }
        const currentTimestamp = Date.now();
        const ttl = Math.floor(currentTimestamp / 1000) + (7 * 24 * 60 * 60);
        const item = {
            ...kline,
            pk: this.createPrimaryKey(kline.exchange, kline.symbol),
            sk: kline.openTime,
            type: 'KLINE',
            timestamp: currentTimestamp,
            ttl
        };
        try {
            await this.docClient.send(new lib_dynamodb_1.PutCommand({
                TableName: this.tableName,
                Item: item,
                ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
            }));
        }
        catch (error) {
            if (error.name === 'ConditionalCheckFailedException') {
                console.log(`Kline already exists for ${kline.exchange}:${kline.symbol} at ${new Date(kline.openTime).toISOString()}`);
                return;
            }
            console.error('Error saving kline to DynamoDB:', error);
            throw new Error('Failed to save kline data');
        }
    }
    async getKlines(params) {
        if (!this.tableName) {
            throw new Error('DynamoDB table name is not configured');
        }
        const { exchange, symbol, startTime, endTime, limit = 100 } = params;
        const pk = this.createPrimaryKey(exchange, symbol);
        const queryParams = {
            TableName: this.tableName,
            KeyConditionExpression: '#pk = :pk',
            ExpressionAttributeNames: {
                '#pk': 'pk'
            },
            ExpressionAttributeValues: {
                ':pk': pk
            },
            Limit: limit,
            ScanIndexForward: false
        };
        if (startTime || endTime) {
            if (startTime && endTime) {
                queryParams.KeyConditionExpression += ' AND #sk BETWEEN :start AND :end';
                queryParams.ExpressionAttributeValues[':start'] = startTime;
                queryParams.ExpressionAttributeValues[':end'] = endTime;
            }
            else if (startTime) {
                queryParams.KeyConditionExpression += ' AND #sk >= :start';
                queryParams.ExpressionAttributeValues[':start'] = startTime;
            }
            else if (endTime) {
                queryParams.KeyConditionExpression += ' AND #sk <= :end';
                queryParams.ExpressionAttributeValues[':end'] = endTime;
            }
            queryParams.ExpressionAttributeNames['#sk'] = 'sk';
        }
        try {
            const result = await this.docClient.send(new lib_dynamodb_1.QueryCommand(queryParams));
            return (result.Items || []);
        }
        catch (error) {
            console.error('Error querying klines from DynamoDB:', error);
            throw new Error('Failed to retrieve kline data');
        }
    }
    async getKlinesByExchange(params) {
        if (!this.tableName) {
            throw new Error('DynamoDB table name is not configured');
        }
        const { exchange, startTime, endTime, limit = 100 } = params;
        const queryParams = {
            TableName: this.tableName,
            IndexName: 'exchange-timestamp-index',
            KeyConditionExpression: '#exchange = :exchange',
            ExpressionAttributeNames: {
                '#exchange': 'exchange'
            },
            ExpressionAttributeValues: {
                ':exchange': exchange
            },
            Limit: limit,
            ScanIndexForward: false
        };
        if (startTime || endTime) {
            if (startTime && endTime) {
                queryParams.KeyConditionExpression += ' AND #timestamp BETWEEN :start AND :end';
                queryParams.ExpressionAttributeValues[':start'] = startTime;
                queryParams.ExpressionAttributeValues[':end'] = endTime;
            }
            else if (startTime) {
                queryParams.KeyConditionExpression += ' AND #timestamp >= :start';
                queryParams.ExpressionAttributeValues[':start'] = startTime;
            }
            else if (endTime) {
                queryParams.KeyConditionExpression += ' AND #timestamp <= :end';
                queryParams.ExpressionAttributeValues[':end'] = endTime;
            }
            queryParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        }
        try {
            const result = await this.docClient.send(new lib_dynamodb_1.QueryCommand(queryParams));
            return (result.Items || []);
        }
        catch (error) {
            console.error('Error querying klines by exchange from DynamoDB:', error);
            throw new Error('Failed to retrieve kline data by exchange');
        }
    }
}
exports.KlineService = KlineService;
