import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { ErrorMessage, PageHeader } from "../App";
import { apiFetch } from "../lib/api";
import type { AuthResponse, User } from "../lib/types";

export function UsersPage() {
  const auth = useOutletContext<AuthResponse>();
  const queryClient = useQueryClient();
  const usersQuery = useQuery<{ users: User[] }>({
    queryKey: ["users"],
    queryFn: () => apiFetch<{ users: User[] }>("/users"),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function handleDeactivate(user: User) {
    if (window.confirm(`Desativar o usuário ${user.name}?`)) deactivate.mutate(user.id);
  }

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Organização"
        title="Usuários"
        description="Gerencie quem participa do espaço de trabalho."
        action={auth.user.role === "admin" ? <Link className="button button-primary" to="/users/new"><span className="plus">+</span> Adicionar usuário</Link> : undefined}
      />
      {usersQuery.isError && <ErrorMessage message={usersQuery.error.message} />}
      {deactivate.isError && <ErrorMessage message={deactivate.error.message} />}
      <div className="card table-card">
        <div className="table-head">
          <span>Nome</span>
          <span>Perfil</span>
          <span>Status</span>
          <span>Ação</span>
        </div>
        {usersQuery.isLoading && <div className="table-empty">Carregando usuários...</div>}
        {!usersQuery.isLoading && usersQuery.data?.users.map((user) => (
          <div className="table-row" key={user.id}>
            <div className="person-cell">
              <div className="avatar small-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
              <div><strong>{user.name}</strong><span>{user.email}</span></div>
            </div>
            <span className="role-label">{user.role === "admin" ? "Administrador" : "Membro"}</span>
            <span className={`status-pill ${user.status}`}>{user.status === "active" ? "Ativo" : "Inativo"}</span>
            <div>
              {user.status === "active" && user.id !== auth.user.id ? (
                <button className="text-button danger-text" onClick={() => handleDeactivate(user)}>Desativar</button>
              ) : <span className="muted">{user.id === auth.user.id ? "Você" : "-"}</span>}
            </div>
          </div>
        ))}
        {!usersQuery.isLoading && usersQuery.data?.users.length === 0 && <div className="table-empty">Nenhum usuário cadastrado.</div>}
      </div>
    </div>
  );
}
