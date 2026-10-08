import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoadingScreen } from "../App";
import { apiFetch, jsonBody } from "../lib/api";
import type { AuthResponse } from "../lib/types";

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meQuery = useQuery<AuthResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<AuthResponse>("/auth/me"),
  });
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = useMutation({
    mutationFn: () =>
      apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: jsonBody({ organizationName, name, email, password }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      navigate("/tasks");
    },
  });

  if (meQuery.isLoading) return <LoadingScreen />;
  if (meQuery.data) return <Navigate to="/tasks" replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    register.mutate();
  }

  return (
    <div className="auth-page">
      <div className="auth-panel auth-intro">
        <span className="brand-mark large">T</span>
        <span className="eyebrow">Seu espaço de trabalho</span>
        <h1>Comece com<br />clareza.</h1>
        <p>Crie sua organização e convide sua equipe para acompanhar cada entrega.</p>
        <div className="intro-line" />
        <span className="small-note">O primeiro usuário será administrador.</span>
      </div>
      <div className="auth-panel auth-form-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">Primeiro acesso</span>
          <h2>Criar organização</h2>
          <p className="muted">Você poderá adicionar os demais usuários depois.</p>
          {register.isError && <div className="alert alert-error">{register.error.message}</div>}
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Nome da organização</span>
              <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
            </label>
            <label className="field">
              <span>Seu nome</span>
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="field">
              <span>Senha</span>
              <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
              <small>Pelo menos 8 caracteres.</small>
            </label>
            <button className="button button-primary button-full" disabled={register.isPending}>
              {register.isPending ? "Criando..." : "Criar organização"}
            </button>
          </form>
          <p className="auth-footer">
            Já possui uma conta? <Link to="/login">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
