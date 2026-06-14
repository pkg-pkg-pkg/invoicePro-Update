import axios from 'axios';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {

  getMiddlewareApiBase,

  initMiddlewareUrl,

  setMiddlewareUrl,

} from './middlewareUrl';



let runtimeBaseUrl = getMiddlewareApiBase();



const api = axios.create({

  baseURL: runtimeBaseUrl,

  headers: {

    'Content-Type': 'application/json',

    'x-client-source': 'mobile',

    'x-client-platform': 'mobile',

  },

  timeout: 15000,

});



api.interceptors.request.use(async (config) => {

  config.baseURL = runtimeBaseUrl;

  const stored = await AsyncStorage.getItem('jwt_token');

  const token = stored || ((global as { __MOBILE_AUTH_TOKEN__?: string }).__MOBILE_AUTH_TOKEN__);

  if (token) {

    config.headers.Authorization = `Bearer ${token}`;

  }

  return config;

});



export async function initMobileApi(): Promise<void> {

  await initMiddlewareUrl();

  runtimeBaseUrl = getMiddlewareApiBase();

  api.defaults.baseURL = runtimeBaseUrl;

}



export function setMobileAuthToken(token: string | null) {

  if (token) {

    (global as { __MOBILE_AUTH_TOKEN__?: string }).__MOBILE_AUTH_TOKEN__ = token;

  } else {

    delete (global as { __MOBILE_AUTH_TOKEN__?: string }).__MOBILE_AUTH_TOKEN__;

  }

}



export async function setMobileApiBaseUrl(baseUrl: string | null) {

  const origin = await setMiddlewareUrl(baseUrl);

  runtimeBaseUrl = `${origin}/api`;

  api.defaults.baseURL = runtimeBaseUrl;

}



export function getMobileApiBaseUrl() {

  return runtimeBaseUrl;

}



export default api;


