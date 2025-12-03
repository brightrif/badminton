import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const fetchMatchData = async (matchId) => {
  const response = await axios.get(`${API_URL}/matches/${matchId}/`);
  return response.data;
};

export const fetchSponsors = async () => {
  const response = await axios.get(`${API_URL}/sponsors/`);
  return response.data;
};