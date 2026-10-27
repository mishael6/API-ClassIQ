import axios from 'axios';
import { BASE_URL } from './auth';
import { authStore } from '../store/authStore';

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const isClassrep = (user) =>
  user?.role === 'classrep' || user?.role === 'class_rep';

/** GET thread messages */
export const fetchIssueMessages = async (token, issueId) => {
  const res = await axios.get(`${BASE_URL}/messages.php`, {
    params: { issue_id: issueId },
    headers: authHeaders(token),
  });
  return res.data;
};

/** POST follow-up in an existing issue thread */
export const sendIssueReply = async (token, issueId, message) => {
  const res = await axios.post(
    `${BASE_URL}/messages.php`,
    { issue_id: issueId, message: message.trim() },
    { headers: authHeaders(token) }
  );
  return res.data;
};

/** List issues for current user (student or class rep) */
export const fetchMyIssues = async (token) => {
  const user = await authStore.getUser();
  const path = isClassrep(user)
    ? `${BASE_URL}/classrep/my_issues.php`
    : `${BASE_URL}/student/get_my_issues.php`;
  const res = await axios.get(path, { headers: authHeaders(token) });
  return res.data;
};

/** Submit a new issue */
export const submitIssue = async (token, { subject, message }) => {
  const user = await authStore.getUser();
  const path = isClassrep(user)
    ? `${BASE_URL}/classrep/report_issue.php`
    : `${BASE_URL}/student/report_issue.php`;
  const res = await axios.post(path, { subject, message }, { headers: authHeaders(token) });
  return res.data;
};

/** Unread admin reply count (for badges) */
export const fetchUnreadCount = async (token) => {
  const res = await axios.get(`${BASE_URL}/messages.php`, {
    params: { unread_count: 1 },
    headers: authHeaders(token),
  });
  return res.data;
};
