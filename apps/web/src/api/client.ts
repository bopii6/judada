import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: false
});

api.interceptors.request.use(config => {
  const adminKey = localStorage.getItem("judada:adminKey");
  if (adminKey && config.headers) {
    config.headers["x-admin-key"] = adminKey;
  }
  return config;
});

export default api;
