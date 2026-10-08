import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorMessage, PageHeader } from "../App";
import { apiFetch, jsonBody } from "../lib/api";
import type { User } from "../lib/types";

export function UserFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  const createUser = useMutation({
    mutationFn: () =>
      apiFetch<{ user: User }>("/users", {
        method: "POST",
        body: jsonBody({ name, email, password, role }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      navigate("/users");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createUser.mutate();
  }

  return (
    <div className="page-container narrow-page">
      <Link className="back-link" to="/users">← Voltar para usuários</Link>
      <PageHeader eyebrow="Organização" title="Adicionar usuário" description="Crie um acesso para alguém da sua equipe." />
      {createUser.isError && <ErrorMessage message={createUser.error.message} />}
      <form className="card form-card form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nome completo</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span>Senha inicial</span>
          <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          <small>Pelo menos 8 caracteres.</small>
        </label>
        <label className="field">
          <span>Perfil</span>
          <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "member")}>
            <option value="member">Membro</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <div className="form-actions">
          <Link className="button button-ghost" to="/users">Cancelar</Link>
          <button className="button button-primary" disabled={createUser.isPending}>
            {createUser.isPending ? "Criando..." : "Criar usuário"}
          </button>
        </div>
      </form>
    </div>
  );
}
