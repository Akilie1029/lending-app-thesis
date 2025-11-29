// src/services/api.ts
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

/**
 * Central axios instance used across the app.
 * - baseURL uses API_BASE from config
 * - automatically attaches Authorization Bearer token (if present)
 * - basic response/error handling hooks
 */

const instance = axios.create({
  baseURL: API_BASE, // make sure API_BASE ends with /api or adjust as needed
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Attach token to requests automatically
instance.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      // If AsyncStorage fails, proceed without token (login will handle auth)
      // console.warn("Failed reading token for request:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Optional: central response interceptor for nicer error messages
instance.interceptors.response.use(
  (resp) => resp,
  (error) => {
    // Normalize error shape so call sites can rely on error.message and error.response?.data
    if (error.response) {
      // server responded with a status
      const serverMessage =
        (error.response.data && (error.response.data.error || error.response.data.message)) ||
        error.response.statusText ||
        "Server error";
      const e: any = new Error(serverMessage);
      e.response = error.response;
      return Promise.reject(e);
    } else if (error.request) {
      // request sent but no response
      const e: any = new Error("Network error: no response from server");
      e.request = error.request;
      return Promise.reject(e);
    } else {
      return Promise.reject(error);
    }
  }
);

export default instance;
