import axios from 'axios';
import { BASE_URL } from './auth';

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

export const generateTrivia = async (student_id, courses) => {
  const res = await axios.post(`${BASE_URL}/ai/trivia_generate.php`, {
    student_id,
    courses,
  });
  return res.data;
};

export const submitTrivia = async (student_id, session_id, answers, score) => {
  const res = await axios.post(`${BASE_URL}/ai/trivia_submit.php`, {
    student_id,
    session_id,
    answers,
    score,
  });
  return res.data;
};

export const fetchLeaderboard = async (student_id) => {
  const res = await axios.get(`${BASE_URL}/ai/trivia_leaderboard.php`, {
    params: { student_id, limit: 20 },
  });
  return res.data;
};