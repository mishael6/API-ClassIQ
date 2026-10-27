import axios from 'axios';

export const BASE_URL = 'https://api-classiq.onrender.com';

// Create axios instance with timeout for all auth requests
const api = axios.create({
  timeout: 20000, // 20 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Validate login response format
 * @param {any} data - Response data from server
 * @throws {Error} If response is invalid
 */
function assertLoginJson(data) {
  if (data == null) throw new Error('Server returned an empty response.');
  if (typeof data === 'string') {
    if (/bootstrap\.php|Fatal error|require_once/i.test(data)) {
      throw new Error('Server maintenance in progress. Please try again later.');
    }
    throw new Error('Server returned HTML instead of JSON.');
  }
  if (typeof data !== 'object' || !data.user || !data.token) {
    throw new Error('Server response is missing user or token.');
  }
}

/**
 * Login a student
 * @param {string} indexNumber - Student's index number
 * @param {string} password - Student's password
 * @returns {Promise<{user: Object, token: string}>}
 */
export const loginStudent = async (indexNumber, password) => {
  try {
    const response = await api.post(`${BASE_URL}/auth/login.php`, {
      index_number: indexNumber,
      password,
    });
    assertLoginJson(response.data);
    return response.data;
  } catch (error) {
    // Add context to the error
    if (!error.isAxiosError) {
      error.isAxiosError = true;
    }
    throw error;
  }
};

/**
 * Get classreps for signup dropdown
 * @param {string} search - Optional search query
 * @returns {Promise<{classreps: Array}>}
 */
export const getClassreps = async (search = '') => {
  const response = await api.get(`${BASE_URL}/auth/get_classreps.php`, {
    params: { search },
  });
  return { classreps: response.data.classreps || [] };
};
