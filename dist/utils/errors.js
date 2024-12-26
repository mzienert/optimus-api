"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = void 0;
exports.handleDatabaseError = handleDatabaseError;
class DatabaseError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
function handleDatabaseError(error, operation) {
    console.error(`Database error during ${operation}:`, error);
    throw new DatabaseError(`Failed to ${operation}`, error);
}
