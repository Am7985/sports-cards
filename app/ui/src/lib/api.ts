import axios from "axios";
console.log("API base:", import.meta.env.VITE_API_BASE_URL);
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });
export default api;
