import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiFetch, jsonBody } from "../lib/api";
import type { AuthResponse } from "../lib/types";
import { useQuery } from "@tanstack/react-query";
import { LoadingScreen } from "../App";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meQuery = useQuery<AuthResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<AuthResponse>("/auth/me"),
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: jsonBody({ email, password }),
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/tasks");
    },
  });

  if (meQuery.isLoading) return <LoadingScreen />;
  if (meQuery.data) return <Navigate to="/tasks" replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate();
  }

  return (
    <div className="auth-page">
      <div className="auth-panel auth-intro">
        <span className="brand-mark large">T</span>
        <span className="eyebrow">Organize o que importa</span>
        <h1>Menos ruído.<br />Mais realização.</h1>
        <p>Uma visão clara do trabalho da sua equipe, do primeiro passo até a última tarefa concluída.</p>
        <div className="intro-line" />
        <span className="small-note">Um espaço simples para fazer acontecer.</span>
      </div>
      <div className="auth-panel auth-form-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">Bem-vindo de volta</span>
          <h2>Entrar na sua conta</h2>
          <p className="muted">Acesse sua organização para continuar.</p>
          {login.isError && <div className="alert alert-error">{login.error.message}</div>}
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>E-mail</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="field">
              <span>Senha</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <button className="button button-primary button-full" disabled={login.isPending}>
              {login.isPending ? "Entrando..." : "Entrar"}
            </button>
          </form>
          <p className="auth-footer">
            Ainda não possui uma organização? <Link to="/register">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
