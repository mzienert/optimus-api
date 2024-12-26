"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const createResponse = (statusCode, body) => {
    console.log('Creating response:', { statusCode, body });
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify(body)
    };
};
const handleError = (error) => {
    console.error('Processing error:', error);
    if (error instanceof Error) {
        if (error.name === 'ResourceNotFoundException') {
            return {
                statusCode: 404,
                message: 'DynamoDB table not found'
            };
        }
        if (error.name === 'ValidationException') {
            return {
                statusCode: 400,
                message: 'Invalid query parameters'
            };
        }
        return {
            statusCode: 500,
            message: 'Internal server error',
            error: error.message
        };
    }
    return {
        statusCode: 500,
        message: 'Unknown error occurred',
        error: String(error)
    };
};
const queryTable = async () => {
    try {
        console.log('Starting table query');
        const scanParams = {
            TableName: process.env.DYNAMODB_TABLE || 'GalvitronTable',
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':type': 'KLINE'
            },
            Limit: 1000
        };
        console.log('Scanning table with params:', scanParams);
        const scanResult = await docClient.send(new lib_dynamodb_1.ScanCommand(scanParams));
        console.log('Scan result:', scanResult);
        return scanResult.Items || [];
    }
    catch (error) {
        console.error('Error during queryTable:', error);
        throw error;
    }
};
const handler = async (event) => {
    console.log('Lambda started. Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        DYNAMODB_TABLE: process.env.DYNAMODB_TABLE,
        AWS_REGION: process.env.AWS_REGION
    });
    try {
        const items = await queryTable();
        const response = {
            message: 'Successfully retrieved records',
            timestamp: new Date().toISOString(),
            count: items.length,
            items: items
        };
        return createResponse(200, response);
    }
    catch (error) {
        console.error('Handler caught error:', error);
        const errorResponse = handleError(error);
        const responseBody = {
            message: errorResponse.message,
            statusCode: errorResponse.statusCode
        };
        if (errorResponse.error) {
            responseBody.error = errorResponse.error;
        }
        return createResponse(errorResponse.statusCode, responseBody);
    }
};
exports.handler = handler;
