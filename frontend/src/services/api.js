import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  timeout: 75000, // 75 seconds to comfortably accommodate free-tier cloud cold starts
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
      localStorage.removeItem("cached_datasets");
      const p = window.location.pathname;
      if (p !== "/login" && p !== "/register" && !p.startsWith("/admin")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// -------------------------
// WARM-UP & SYSTEM HELPERS
// -------------------------

let warmUpInitiated = false;

export const warmUpBackend = async () => {
  if (warmUpInitiated) return;
  warmUpInitiated = true;
  try {
    // Non-blocking ping to initiate cloud container wake-up early
    await api.get("/health", { timeout: 60000 });
  } catch {
    // Silently ignore ping errors
  }
};

// -------------------------
// AUTH SERVICES
// -------------------------

export const loginUser = async ({ email, password }) => {
  const cleanIdentifier = (email || "").trim();

  try {
    const response = await api.post("/auth/login", { email: cleanIdentifier, password });
    const data = response.data;
    if (data.is_admin || data.admin_token) {
      localStorage.setItem("admin_token", data.admin_token || data.access_token);
      localStorage.setItem("user_role", "admin");
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_info");
    } else if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.removeItem("admin_token");
      localStorage.removeItem("user_role");
      if (data.user) {
        localStorage.setItem("user_info", JSON.stringify(data.user));
      }
    }
    return data;
  } catch (err) {
    // If backend rejected string with 422 (e.g. email validation) or not found, try adminLogin endpoint
    if (err.response?.status === 422 || err.response?.status === 401 || !cleanIdentifier.includes("@")) {
      try {
        const adminRes = await adminLogin({ username: cleanIdentifier, password });
        if (adminRes?.admin_token) {
          localStorage.setItem("admin_token", adminRes.admin_token);
          localStorage.setItem("user_role", "admin");
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_info");
          return {
            is_admin: true,
            admin_token: adminRes.admin_token,
            access_token: adminRes.admin_token,
          };
        }
      } catch (adminErr) {
        // If admin login also failed, re-throw the original error
        throw err;
      }
    }
    throw err;
  }
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
  localStorage.removeItem("cached_datasets");
  window.location.href = "/";
};

// -------------------------
// DATASET SERVICES
// -------------------------

let inFlightDatasetsPromise = null;

export const getCachedDatasets = () => {
  try {
    const raw = localStorage.getItem("cached_datasets");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const setCachedDatasets = (datasets) => {
  try {
    if (Array.isArray(datasets)) {
      localStorage.setItem("cached_datasets", JSON.stringify(datasets));
    }
  } catch (e) {
    console.warn("Could not cache datasets to localStorage", e);
  }
};

export const getDatasets = (forceRefresh = false) => {
  // Deduplicate concurrent in-flight requests
  if (inFlightDatasetsPromise && !forceRefresh) {
    return inFlightDatasetsPromise;
  }

  inFlightDatasetsPromise = api.get("/datasets/")
    .then((response) => {
      if (response?.data && Array.isArray(response.data)) {
        setCachedDatasets(response.data);
      }
      return response;
    })
    .finally(() => {
      inFlightDatasetsPromise = null;
    });

  return inFlightDatasetsPromise;
};

export const uploadDataset = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/datasets/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  // Invalidate in-flight and update fresh
  getDatasets(true).catch(() => { });
  return response.data;
};

export const getDatasetAnalysis = async (datasetId, regenerate = false) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.get(`/datasets/${datasetId}/analysis`, {
    params: regenerate ? { regenerate: true } : undefined,
  });
  return response.data;
};

export const regenerateDatasetAiAnalysis = async (datasetId) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.post(`/datasets/${datasetId}/regenerate-ai-analysis`);
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

export const trainAutoMl = async (
  datasetId,
  { target_column, excluded_features, included_features }
) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.post(`/datasets/${datasetId}/ml/train`, {
    target_column,
    excluded_features,
    included_features,
  });
  return response.data;
};

export const getDatasetBenchmark = async (datasetId) => {
  if (!datasetId) {
    throw new Error("Dataset ID is missing");
  }
  const response = await api.get(`/datasets/${datasetId}/ml/benchmark`);
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

// -------------------------
// ADMIN SERVICES
// -------------------------

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  timeout: 15000,
});

adminApi.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem("admin_token");
  if (adminToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

export const adminLogin = async ({ username, password }) => {
  const response = await adminApi.post("/admin/login", { username, password });
  if (response.data.admin_token) {
    localStorage.setItem("admin_token", response.data.admin_token);
  }
  return response.data;
};

export const adminLogout = () => {
  localStorage.removeItem("admin_token");
};

export const getAdminSettings = async () => {
  const response = await adminApi.get("/admin/settings");
  return response.data;
};

export const updateAdminSettings = async ({ active_provider, active_model }) => {
  const response = await adminApi.put("/admin/settings", {
    active_provider,
    active_model,
  });
  return response.data;
};

export const getAdminProviders = async () => {
  const response = await adminApi.get("/admin/providers");
  return response.data;
};

export default api;