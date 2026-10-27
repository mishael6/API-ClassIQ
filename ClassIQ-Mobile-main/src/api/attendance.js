import axios from 'axios';
import { BASE_URL } from './auth';

export const markAttendance = async ({ classrep_id, code, lecture_name, index_number, device_id, student_lat, student_lng }) => {
  const response = await axios.post(`${BASE_URL}/student/mark_attendance.php`, {
    classrep_id,
    code,
    lecture_name,
    index_number,
    device_id,
    student_lat,
    student_lng,
  });
  return response.data;
};