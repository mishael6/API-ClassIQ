import axios from 'axios';
import { BASE_URL } from './auth';

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

export const fetchAttendance = async (token) => {
  const res = await axios.get(`${BASE_URL}/classrep/attendance.php`, {
    headers: authHeaders(token),
  });
  return res.data.records || {};
};

/**
 * Students assigned to this class rep.
 * Backend: GET classrep/students.php — Bearer token identifies the rep; JSON body e.g.
 * { "students": [ { "id", "name", "index_number", "department", "program", "level", "email", "phone" } ] }
 */
export const fetchStudents = async (token) => {
  const res = await axios.get(`${BASE_URL}/classrep/students.php`, {
    headers: authHeaders(token),
  });
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.students)) return d.students;
  if (Array.isArray(d.data)) return d.data;
  if (Array.isArray(d.records)) return d.records;
  return [];
};

export const generateQR = async (token, { lecture_name, lat, lng, radius_m }) => {
  const res = await axios.post(`${BASE_URL}/classrep/generate_qr.php`, {
    lecture_name, lat, lng, radius_m,
  }, { headers: authHeaders(token) });
  return res.data;
};

export const endSession = async (token, session_id) => {
  const res = await axios.post(`${BASE_URL}/classrep/end_session.php`, {
    session_id,
  }, { headers: authHeaders(token) });
  return res.data;
};

export const fetchSavedLectures = async (token) => {
  const res = await axios.get(`${BASE_URL}/classrep/saved_lectures.php`, {
    headers: authHeaders(token),
  });
  return res.data;
};

export const saveLecture = async (token, name) => {
  const res = await axios.post(`${BASE_URL}/classrep/saved_lectures.php`, { name }, {
    headers: authHeaders(token),
  });
  return res.data;
};

export const deleteLecture = async (token, id) => {
  const res = await axios.post(`${BASE_URL}/classrep/saved_lectures.php`, { _method: 'DELETE', id }, {
    headers: authHeaders(token),
  });
  return res.data;
};