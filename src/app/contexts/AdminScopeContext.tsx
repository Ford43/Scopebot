import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type DataScope = "all" | "mine";

const STORAGE_KEY = "scopebot_admin_scope";

function readStoredScope(): DataScope {
  try {
    return localStorage.getItem(STORAGE_KEY) === "mine" ? "mine" : "all";
  } catch {
    return "all";
  }
}

interface AdminScopeContextValue {
  scope: DataScope;
  setScope: (scope: DataScope) => void;
  isAdmin: boolean;
  scopeParam: DataScope;
}

const AdminScopeContext = createContext<AdminScopeContextValue | null>(null);

export function AdminScopeProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: ReactNode;
}) {
  const [scope, setScopeState] = useState<DataScope>(readStoredScope);

  const setScope = useCallback((next: DataScope) => {
    setScopeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const effective: DataScope = "mine";

  return (
    <AdminScopeContext.Provider
      value={{
        scope: effective,
        setScope,
        isAdmin,
        scopeParam: effective,
      }}
    >
      {children}
    </AdminScopeContext.Provider>
  );
}

export function useAdminScope(): AdminScopeContextValue {
  const ctx = useContext(AdminScopeContext);
  if (!ctx) {
    return {
      scope: "mine",
      setScope: () => {},
      isAdmin: false,
      scopeParam: "mine",
    };
  }
  return ctx;
}

export function AdminScopeToggle() {
  const { isAdmin, scope, setScope } = useAdminScope();
  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      <button
        type="button"
        onClick={() => setScope("all")}
        className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
          scope === "all"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-800"
        }`}
        style={{ fontWeight: 600 }}
      >
        ทั้งระบบ
      </button>
      <button
        type="button"
        onClick={() => setScope("mine")}
        className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
          scope === "mine"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-800"
        }`}
        style={{ fontWeight: 600 }}
      >
        บอทของฉัน
      </button>
    </div>
  );
}
