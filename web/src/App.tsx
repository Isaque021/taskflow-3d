import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { apiFetch } from "./lib/api";
import type { AuthResponse } from "./lib/types";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { TaskDetailsPage } from "./pages/TaskDetailsPage";
import { TaskFormPage } from "./pages/TaskFormPage";
import { TaskListPage } from "./pages/TaskListPage";
import { UserFormPage } from "./pages/UserFormPage";
import { UsersPage } from "./pages/UsersPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/tasks" replace />} />
          <Route path="tasks" element={<TaskListPage />} />
          <Route path="tasks/new" element={<TaskFormPage />} />
          <Route path="tasks/:id" element={<TaskDetailsPage />} />
          <Route path="tasks/:id/edit" element={<TaskFormPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/new" element={<UserFormPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/tasks" replace />} />
    </Routes>
  );
}

function ProtectedRoute() {
  const authQuery = useQuery<AuthResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<AuthResponse>("/auth/me"),
  });

  if (authQuery.isLoading) return <LoadingScreen />;
  if (authQuery.isError || !authQuery.data) return <Navigate to="/login" replace />;

  return <Outlet context={authQuery.data} />;
}

export function AppShell() {
  const authQuery = useQuery<AuthResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<AuthResponse>("/auth/me"),
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = authQuery.data;

  const logout = useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
  });

  if (!auth) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/tasks">
          <span className="brand-mark">T</span>
          <span>taskflow</span>
        </Link>
        <div className="organization-card">
          <span className="eyebrow">Organização</span>
          <strong>{auth.organization.name}</strong>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          <NavLink className="nav-link" to="/tasks">
            <span>✓</span> Tarefas
          </NavLink>
          {auth.user.role === "admin" && (
            <NavLink className="nav-link" to="/users">
              <span>◌</span> Usuários
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{auth.user.name.slice(0, 1).toUpperCase()}</div>
          <div className="user-summary">
            <strong>{auth.user.name}</strong>
            <span>{auth.user.role === "admin" ? "Administrador" : "Membro"}</span>
          </div>
          <button className="icon-button" title="Sair" onClick={() => logout.mutate()} disabled={logout.isPending}>
            ↗
          </button>
        </div>
      </aside>
      <main className="main-content">
        <div className="mobile-topbar">
          <Link className="brand" to="/tasks">
            <span className="brand-mark">T</span>
            <span>taskflow</span>
          </Link>
          <button className="button button-ghost" onClick={() => logout.mutate()}>
            Sair
          </button>
        </div>
        <div key={location.pathname} className="page-transition">
          <Outlet context={auth} />
        </div>
      </main>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="centered-screen">
      <div className="spinner" />
      <span>Carregando...</span>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="alert alert-error">{message}</div>;
}
