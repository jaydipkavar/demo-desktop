// const BASE_URL = "https://api.agentact.com";
const BASE_URL = "http://141.148.221.8:8000";

export const LOGIN_URL = `${BASE_URL}/login`;
export const SESSION_LIST_URL = `${BASE_URL}/get-all-session`;
export const REFRESH_TOKEN_URL = `${BASE_URL}/refresh`;
export const SESSION_DETAIL_URL = (id: number) => `${BASE_URL}/get-session-by-id/${id}`
export const SESSSION_DELETE_URL = (id: number) => `${BASE_URL}/delete-session/${id}`
export const PROCESS_HTML_URL = `${BASE_URL}/process-html`;