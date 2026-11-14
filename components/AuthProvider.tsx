"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/auth";

type AuthContextValue = {
  role: UserRole | null;
  loading: boolean;
  canManageAssets: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  role: null,
  loading: true,
  canManageAssets: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session");

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load the current user session");
        }

        const data = await response.json();
        if (active) {
          setRole(data.user.role);
        }
      } catch (error) {
        console.error("Error loading the current user session:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        role,
        loading,
        canManageAssets: role === "sysadmin" || role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
