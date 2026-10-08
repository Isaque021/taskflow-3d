import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorMessage, PageHeader } from "../App";
import { apiFetch, jsonBody } from "../lib/api";
import type { Subtask, Task } from "../lib/types";
import { categoryLabels } from "../lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TaskDetailsPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [subtaskName, setSubtaskName] = useState("");
  const taskQuery = useQuery<{ task: Task; subtasks: Subtask[] }>({
    queryKey: ["task", id],
    queryFn: () => apiFetch<{ task: Task; subtasks: Subtask[] }>(`/tasks/${id}`),
    enabled: Boolean(id),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["task", id] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const toggleTask = useMutation({
    mutationFn: (completed: boolean) => apiFetch(`/tasks/${id}`, { method: "PATCH", body: jsonBody({ completed }) }),
    onSuccess: refresh,
  });

  const addSubtask = useMutation({
    mutationFn: (name: string) => apiFetch(`/tasks/${id}/subtasks`, { method: "POST", body: jsonBody({ name }) }),
    onSuccess: async () => {
      setSubtaskName("");
      await refresh();
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) =>
      apiFetch(`/tasks/${id}/subtasks/${subtaskId}`, { method: "PATCH", body: jsonBody({ completed }) }),
    onSuccess: refresh,
  });

  const deleteSubtask = useMutation({
    mutationFn: (subtaskId: string) => apiFetch(`/tasks/${id}/subtasks/${subtaskId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  if (taskQuery.isLoading) return <div className="page-container"><div className="card loading-card">Carregando tarefa...</div></div>;
  if (taskQuery.isError || !taskQuery.data) return <div className="page-container"><ErrorMessage message={taskQuery.error?.message ?? "Tarefa não encontrada."} /></div>;

  const { task, subtasks } = taskQuery.data;
  const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length;

  function handleAddSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (subtaskName.trim()) addSubtask.mutate(subtaskName.trim());
  }

  return (
    <div className="page-container narrow-page">
      <Link className="back-link" to="/tasks">← Voltar para tarefas</Link>
      <PageHeader
        eyebrow={categoryLabels[task.category]}
        title={task.name}
        description={task.description ?? "Sem descrição adicionada."}
        action={<Link className="button button-secondary" to={`/tasks/${task.id}/edit`}>Editar tarefa</Link>}
      />
      <div className="detail-grid">
        <section className="card detail-card">
          <div className="detail-status-row">
            <button className={`task-check large-check ${task.completed ? "checked" : ""}`} onClick={() => toggleTask.mutate(!task.completed)}>
              {task.completed ? "✓" : ""}
            </button>
            <div>
              <span className="eyebrow">Status</span>
              <strong>{task.completed ? "Concluída" : task.overdue ? "Atrasada" : "Em andamento"}</strong>
            </div>
          </div>
          <div className="detail-info-grid">
            <div><span className="eyebrow">Vencimento</span><strong className={task.overdue ? "overdue" : ""}>{formatDate(task.dueAt)}</strong></div>
            <div><span className="eyebrow">Responsável</span><strong>{task.responsible?.name ?? "Não atribuído"}</strong></div>
          </div>
        </section>

        <section className="card detail-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Checklist</span>
              <h2>Subtarefas</h2>
            </div>
            <span className="progress-count">{completedSubtasks}/{subtasks.length}</span>
          </div>
          <form className="inline-form" onSubmit={handleAddSubtask}>
            <input value={subtaskName} onChange={(event) => setSubtaskName(event.target.value)} placeholder="Adicionar uma subtarefa..." maxLength={150} />
            <button className="button button-primary" disabled={addSubtask.isPending || !subtaskName.trim()}>Adicionar</button>
          </form>
          {addSubtask.isError && <ErrorMessage message={addSubtask.error.message} />}
          {subtasks.length === 0 && <p className="muted empty-inline">Nenhuma subtarefa adicionada.</p>}
          <div className="subtask-list">
            {subtasks.map((subtask) => (
              <div className={`subtask-row ${subtask.completed ? "is-completed" : ""}`} key={subtask.id}>
                <button className={`task-check small-check ${subtask.completed ? "checked" : ""}`} onClick={() => toggleSubtask.mutate({ subtaskId: subtask.id, completed: !subtask.completed })}>
                  {subtask.completed ? "✓" : ""}
                </button>
                <span>{subtask.name}</span>
                <button className="icon-button danger" onClick={() => deleteSubtask.mutate(subtask.id)} title="Excluir subtarefa">×</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
