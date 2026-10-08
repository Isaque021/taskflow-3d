import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch, jsonBody } from "../lib/api";
import type { Category, Task } from "../lib/types";
import { categoryLabels } from "../lib/types";
import { ErrorMessage, PageHeader } from "../App";
import { useState } from "react";

const statusLabels = {
  all: "Todas",
  pending: "Pendentes",
  completed: "Concluídas",
  overdue: "Atrasadas",
} as const;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function TaskListPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<keyof typeof statusLabels>("all");
  const [category, setCategory] = useState<"all" | Category>("all");
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (category !== "all") query.set("category", category);
  const queryString = query.toString();

  const tasksQuery = useQuery<{ tasks: Task[] }>({
    queryKey: ["tasks", status, category],
    queryFn: () => apiFetch<{ tasks: Task[] }>(`/tasks${queryString ? `?${queryString}` : ""}`),
  });

  const toggleTask = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      apiFetch(`/tasks/${id}`, { method: "PATCH", body: jsonBody({ completed }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => apiFetch(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  function handleDelete(id: string) {
    if (window.confirm("Excluir esta tarefa e suas subtarefas?")) deleteTask.mutate(id);
  }

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Visão geral"
        title="Tarefas"
        description="Acompanhe o que precisa ser feito pela sua organização."
        action={
          <Link className="button button-primary add-task-button" to="/tasks/new">
            <span className="plus">+</span> Adicionar tarefa
          </Link>
        }
      />

      <div className="toolbar">
        <div className="segmented-control" aria-label="Filtrar status">
          {(Object.keys(statusLabels) as Array<keyof typeof statusLabels>).map((value) => (
            <button key={value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>
              {statusLabels[value]}
            </button>
          ))}
        </div>
        <select className="compact-select" value={category} onChange={(event) => setCategory(event.target.value as "all" | Category)} aria-label="Filtrar categoria">
          <option value="all">Todas as categorias</option>
          <option value="market">Mercado</option>
          <option value="car">Carro</option>
          <option value="work">Trabalho</option>
        </select>
      </div>

      {tasksQuery.isError && <ErrorMessage message={tasksQuery.error.message} />}
      {toggleTask.isError && <ErrorMessage message={toggleTask.error.message} />}
      {deleteTask.isError && <ErrorMessage message={deleteTask.error.message} />}
      {tasksQuery.isLoading && <div className="card loading-card">Carregando tarefas...</div>}
      {!tasksQuery.isLoading && tasksQuery.data?.tasks.length === 0 && (
        <div className="empty-state card">
          <div className="empty-icon">✓</div>
          <h3>Nenhuma tarefa encontrada</h3>
          <p>Comece adicionando uma tarefa para organizar o próximo passo.</p>
          <Link className="button button-secondary" to="/tasks/new">Adicionar primeira tarefa</Link>
        </div>
      )}
      <div className="task-list">
        {tasksQuery.data?.tasks.map((task) => (
          <article className={`task-card card ${task.completed ? "is-completed" : ""}`} key={task.id}>
            <button
              className={`task-check ${task.completed ? "checked" : ""}`}
              aria-label={task.completed ? "Reabrir tarefa" : "Concluir tarefa"}
              onClick={() => toggleTask.mutate({ id: task.id, completed: !task.completed })}
            >
              {task.completed ? "✓" : ""}
            </button>
            <div className="task-main">
              <div className="task-title-row">
                <Link to={`/tasks/${task.id}`} className="task-title">{task.name}</Link>
                <span className={`category-tag category-${task.category}`}>{categoryLabels[task.category]}</span>
              </div>
              {task.description && <p className="task-description">{task.description}</p>}
              <div className="task-meta">
                <span className={task.overdue ? "overdue" : ""}>◷ {task.overdue ? "Atrasada · " : ""}{formatDate(task.dueAt)}</span>
                <span>{task.responsible?.name ?? "Não atribuída"}</span>
                {task.subtasks && task.subtasks.total > 0 && <span>☷ {task.subtasks.completed}/{task.subtasks.total}</span>}
              </div>
            </div>
            <div className="task-actions">
              <Link className="icon-button" to={`/tasks/${task.id}/edit`} title="Editar tarefa">✎</Link>
              <button className="icon-button danger" onClick={() => handleDelete(task.id)} title="Excluir tarefa">×</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
