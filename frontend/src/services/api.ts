import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001",
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchProfile = async () => {
  const res = await api.get('/api/profile');
  return res.data;
};

export const saveProfile = async (profile: {
  resume_text?: string;
  full_name?: string;
  title?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  skills?: string;
  bio?: string;
}) => {
  const res = await api.post('/api/profile', profile);
  return res.data;
};

export const parseResume = async (resumeText: string) => {
  const res = await api.post('/api/profile/parse', { resume_text: resumeText });
  return res.data;
};

export const scrapeJobs = async (payload: any) => {
  const res = await api.post('/api/jobs/scrape', payload);
  return res.data;
};

export const saveJobs = async (jobsToSave: any[], sessionName: string) => {
  const res = await api.post('/api/jobs/save', { jobs: jobsToSave, session_name: sessionName });
  return res.data;
};

export const fetchSavedJobs = async () => {
  const res = await api.get('/api/jobs');
  return res.data;
};

export const draftEmail = async (jobId: number) => {
  try {
    const res = await api.post(`/api/jobs/${jobId}/draft-email`);
    return res.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error("Failed to draft email");
  }
};
