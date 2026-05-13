import axios from "axios"

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000"

export function api(token: string) {
  return axios.create({
    baseURL: SERVER_URL,
    headers: { Authorization: `Bearer ${token}` },
  })
}
