import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_info");
      if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// -------------------------
// AUTH SERVICES
// -------------------------

export const loginUser = async ({ email, password }) => {
  const response = await api.post("/auth/login", { email, password });
  if (response.data.access_token) {
    localStorage.setItem("access_token", response.data.access_token);
    if (response.data.user) {
      localStorage.setItem("user_info", JSON.stringify(response.data.user));
    }
  }
  return response.data;
};

export const registerUser = async ({ name, email, password }) => {
  const response = await api.post("/auth/register", { name, email, password });
  if (response.data.access_token) {
    localStorage.setItem("access_token", response.data.access_token);
    if (response.data.user) {
      localStorage.setItem("user_info", JSON.stringify(response.data.user));
    }
  }
  return response.data;
};

export const loginWithGoogle = async (credential) => {
  const response = await api.post("/auth/google", { credential });
  if (response.data.access_token) {
    localStorage.setItem("access_token", response.data.access_token);
    if (response.data.user) {
      localStorage.setItem("user_info", JSON.stringify(response.data.user));
    }
  }
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  if (response.data) {
    localStorage.setItem("user_info", JSON.stringify(response.data));
  }
  return response.data;
};

export const updateProfile = async ({ name }) => {
  const response = await api.put("/auth/profile", { name });
  if (response.data) {
    localStorage.setItem("user_info", JSON.stringify(response.data));
  }
  return response.data;
};

export const changePassword = async ({ current_password, new_password }) => {
  const response = await api.put("/auth/change-password", {
    current_password,
    new_password,
  });
  return response.data;
};

export const logoutUser = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_info");
  window.location.href = "/login";
};

// -------------------------
// DATASET SERVICES
// -------------------------

export const getDatasets = () => {
  return api.get("/datasets/");
};

export const uploadDataset = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/datasets/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getDatasetAnalysis = async (datasetId) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.get(`/datasets/${datasetId}/analysis`);
  return response.data;
};

// -------------------------
// SQL ANALYST SERVICES
// -------------------------

export const getDatasetSqlSchema = async (datasetId) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.get(`/datasets/${datasetId}/sql/schema`);
  return response.data;
};

export const executeSqlQuery = async (datasetId, { query, sql, mode = "nl" }) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.post(`/datasets/${datasetId}/sql/query`, {
    query,
    sql,
    mode,
  });
  return response.data;
};

// -------------------------
// AUTOML SERVICES
// -------------------------

export const getDatasetMlTargets = async (datasetId) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.get(`/datasets/${datasetId}/ml/targets`);
  return response.data;
};

export const trainAutoMl = async (datasetId, { target_column }) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.post(`/datasets/${datasetId}/ml/train`, {
    target_column,
  });
  return response.data;
};

export const predictAutoMl = async (datasetId, { model_file, features }) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.post(`/datasets/${datasetId}/ml/predict`, {
    model_file,
    features,
  });
  return response.data;
};

export default api;