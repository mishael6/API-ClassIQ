/**
 * Centralized Error Handler for ClassIQ Mobile
 * Provides consistent error handling and user-friendly messages
 */

// Error type constants
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER: 'SERVER_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  AUTH: 'AUTH_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

// User-friendly error messages
const ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK]: 'Network error. Please check your internet connection and try again.',
  [ERROR_TYPES.TIMEOUT]: 'Request timed out. Please check your internet connection and try again.',
  [ERROR_TYPES.SERVER]: 'Server error. Please try again later or contact support.',
  [ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

// HTTP status code to error type mapping
const STATUS_CODE_MAP = {
  400: ERROR_TYPES.VALIDATION,
  401: ERROR_TYPES.AUTH,
  403: ERROR_TYPES.AUTH,
  404: ERROR_TYPES.VALIDATION,
  409: ERROR_TYPES.VALIDATION,
  422: ERROR_TYPES.VALIDATION,
  429: ERROR_TYPES.VALIDATION,
  500: ERROR_TYPES.SERVER,
  502: ERROR_TYPES.SERVER,
  503: ERROR_TYPES.SERVER,
  504: ERROR_TYPES.SERVER,
};

// Default messages for specific status codes
const STATUS_MESSAGES = {
  400: 'Invalid data. Please check your information.',
  401: 'Authentication failed. Please check your credentials.',
  403: 'Access denied. You may need to sign up first.',
  404: 'Resource not found.',
  409: 'A record with this information already exists.',
  422: 'Validation failed. Please check your input.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Server error. Please try again later.',
  502: 'Server temporarily unavailable. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
  504: 'Server timeout. Please try again later.',
};

/**
 * Analyze an error and return structured error information
 * @param {Error} error - The error to analyze
 * @returns {Object} Structured error with type, message, and details
 */
export const analyzeError = (error) => {
  const result = {
    type: ERROR_TYPES.UNKNOWN,
    message: ERROR_MESSAGES[ERROR_TYPES.UNKNOWN],
    details: null,
    statusCode: null,
    originalError: error,
  };

  // Handle axios errors
  if (error?.isAxiosError) {
    // Network error (no response)
    if (!error.response && error.code === 'ECONNABORTED') {
      result.type = ERROR_TYPES.TIMEOUT;
      result.message = ERROR_MESSAGES[ERROR_TYPES.TIMEOUT];
    } else if (!error.response) {
      result.type = ERROR_TYPES.NETWORK;
      result.message = ERROR_MESSAGES[ERROR_TYPES.NETWORK];
    } 
    // Server responded with error
    else if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      result.statusCode = status;
      result.type = STATUS_CODE_MAP[status] || ERROR_TYPES.SERVER;
      result.message = STATUS_MESSAGES[status] || ERROR_MESSAGES[result.type];
      
      // Extract message from response if available
      if (data?.message) {
        result.message = data.message;
      } else if (typeof data === 'string') {
        // Check for PHP/HTML error pages
        if (data.includes('bootstrap') || data.includes('Fatal error')) {
          result.message = 'Server maintenance in progress. Please try again later.';
        }
      }
      
      result.details = data;
    }
  } 
  // Handle network errors without axios
  else if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
    result.type = ERROR_TYPES.NETWORK;
    result.message = ERROR_MESSAGES[ERROR_TYPES.NETWORK];
  }
  // Handle timeout errors
  else if (error?.code === 'ECONNABORTED') {
    result.type = ERROR_TYPES.TIMEOUT;
    result.message = ERROR_MESSAGES[ERROR_TYPES.TIMEOUT];
  }
  // Use custom message if provided
  else if (error?.message) {
    result.message = error.message;
  }

  return result;
};

/**
 * Get a user-friendly error message from an error
 * @param {Error} error - The error to format
 * @param {string} fallbackMessage - Message to use if analysis fails
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error, fallbackMessage = null) => {
  const analyzed = analyzeError(error);
  return analyzed.message || fallbackMessage || ERROR_MESSAGES[ERROR_TYPES.UNKNOWN];
};

/**
 * Log error for debugging (can be extended to send to error tracking service)
 * @param {Error} error - The error to log
 * @param {string} context - Context where the error occurred
 */
export const logError = (error, context = '') => {
  const analyzed = analyzeError(error);
  
  console.log(`[ClassIQ Error] ${context}:`, {
    type: analyzed.type,
    message: analyzed.message,
    statusCode: analyzed.statusCode,
    details: analyzed.details,
    stack: error?.stack,
  });
  
  // In production, you could send this to an error tracking service
  // e.g., Sentry, Bugsnag, etc.
};

/**
 * Check if an error is a network-related error
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
export const isNetworkError = (error) => {
  const analyzed = analyzeError(error);
  return analyzed.type === ERROR_TYPES.NETWORK || analyzed.type === ERROR_TYPES.TIMEOUT;
};

/**
 * Check if an error is an authentication error
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
export const isAuthError = (error) => {
  const analyzed = analyzeError(error);
  return analyzed.type === ERROR_TYPES.AUTH;
};

/**
 * Create an axios instance with default error handling
 * @param {Object} config - Axios configuration
 * @returns {import('axios').AxiosInstance}
 */
export const createApiClient = (config = {}) => {
  const axios = require('axios');
  
  const defaultConfig = {
    timeout: 15000, // 15 second timeout
    headers: {
      'Content-Type': 'application/json',
    },
    ...config,
  };
  
  const client = axios.create(defaultConfig);
  
  // Add response interceptor for consistent error handling
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const analyzed = analyzeError(error);
      error.analyzedError = analyzed;
      return Promise.reject(error);
    }
  );
  
  return client;
};

export default {
  analyzeError,
  getErrorMessage,
  logError,
  isNetworkError,
  isAuthError,
  createApiClient,
  ERROR_TYPES,
};