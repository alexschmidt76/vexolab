import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import axios from "axios"
import { saveToken, getToken, clearToken } from "./auth"

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000"

type AuthContextType = {
  token: string | null
  user: any | null
  loading: boolean
  login: (token: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const stored = await getToken()
        if (stored) {
          setToken(stored)
          await fetchUser(stored)
        }
      } catch {
        await clearToken()
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function fetchUser(jwt: string) {
    const { data } = await axios.get(`${SERVER_URL}/users/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    setUser(data)
  }

  async function login(jwt: string) {
    await saveToken(jwt)
    setToken(jwt)
    await fetchUser(jwt)
  }

  async function logout() {
    await clearToken()
    setToken(null)
    setUser(null)
  }

  async function refreshUser() {
    if (token) await fetchUser(token)
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
