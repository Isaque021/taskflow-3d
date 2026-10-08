import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorMessage, PageHeader } from "../App";
import { apiFetch, jsonBody } from "../lib/api";
import type { Category, Task, User } from "../lib/types";

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatBrazilianDateInput(value: string) {
  const [year = "", month = "", day = ""] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

function maskBrazilianDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBrazilianDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const [, dayText = "", monthText = "", yearText = ""] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

type TaskForm = {
  name: string;
  description: string;
  responsibleUserId: string;
  dueAt: string;
  category: Category;
};

const emptyForm: TaskForm = {
  name: "",
  description: "",
  responsibleUserId: "",
  dueAt: "",
  category: "work",
};

export function TaskFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [dueDateInput, setDueDateInput] = useState("");
  const [dueTimeInput, setDueTimeInput] = useState("");

  const usersQuery = useQuery<{ users: Array<Pick<User, "id" | "name" | "status">> }>({
    queryKey: ["users", "assignees"],
    queryFn: () => apiFetch<{ users: Array<Pick<User, "id" | "name" | "status">> }>("/users/assignees"),
  });
  const taskQuery = useQuery<{ task: Task }>({
    queryKey: ["task", id],
    queryFn: () => apiFetch<{ task: Task }>(`/tasks/${id}`),
    enabled: isEditing,
  });

  useEffect(() => {
    if (!taskQuery.data?.task) return;
    const task = taskQuery.data.task;
    const localDateTime = toDateTimeLocal(task.dueAt);
    const [localDate = ""] = localDateTime.split("T");
    const [, localTime = ""] = localDateTime.split("T");
    setDueDateInput(formatBrazilianDateInput(localDate));
    setDueTimeInput(localTime);
    setForm({
      name: task.name,
      description: task.description ?? "",
      responsibleUserId: task.responsibleUserId ?? "",
      dueAt: localDateTime,
      category: task.category,
    });
  }, [taskQuery.data]);

  const saveTask = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        description: form.description || null,
        responsibleUserId: form.responsibleUserId || null,
        dueAt: new Date(form.dueAt).toISOString(),
        category: form.category,
      };
      return apiFetch<{ task: Task }>(isEditing ? `/tasks/${id}` : "/tasks", {
        method: isEditing ? "PATCH" : "POST",
        body: jsonBody(body),
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task", data.task.id] });
      navigate(`/tasks/${data.task.id}`);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveTask.mutate();
  }

  function update<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateDueAt(date: string, time: string) {
    update("dueAt", date && time ? `${date}T${time}` : "");
  }

  function handleDueDateChange(value: string) {
    const maskedValue = maskBrazilianDate(value);
    setDueDateInput(maskedValue);
    updateDueAt(parseBrazilianDate(maskedValue) ?? "", dueTimeInput);
  }

  if (isEditing && taskQuery.isLoading) return <div className="page-container"><div className="card loading-card">Carregando tarefa...</div></div>;
  if (taskQuery.isError) return <div className="page-container"><ErrorMessage message={taskQuery.error.message} /></div>;

  return (
    <div className="page-container narrow-page">
      <PageHeader
        eyebrow={isEditing ? "Editar tarefa" : "Nova tarefa"}
        title={isEditing ? "Ajuste os detalhes" : "Adicionar tarefa"}
        description={isEditing ? "Mantenha as informações sempre atualizadas." : "Registre o próximo passo da sua organização."}
      />
      {saveTask.isError && <ErrorMessage message={saveTask.error.message} />}
      <form className="card form-card form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nome da tarefa</span>
          <input autoFocus maxLength={150} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Ex.: Preparar apresentação" required />
        </label>
        <label className="field">
          <span>Descrição <small>(opcional)</small></span>
          <textarea rows={5} maxLength={5000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Adicione algum contexto para a equipe..." />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Pessoa responsável <small>(opcional)</small></span>
            <select value={form.responsibleUserId} onChange={(event) => update("responsibleUserId", event.target.value)}>
              <option value="">Não atribuído</option>
              {usersQuery.data?.users.filter((user) => user.status === "active").map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Categoria</span>
            <select value={form.category} onChange={(event) => update("category", event.target.value as Category)} required>
              <option value="market">Mercado</option>
              <option value="car">Carro</option>
              <option value="work">Trabalho</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Data de vencimento <small>(dd/mm/aaaa)</small></span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="dd/mm/aaaa"
              maxLength={10}
              pattern="\d{2}/\d{2}/\d{4}"
              value={dueDateInput}
              onChange={(event) => handleDueDateChange(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Horário de vencimento</span>
            <input
              type="time"
              value={dueTimeInput}
              onChange={(event) => {
                setDueTimeInput(event.target.value);
                updateDueAt(parseBrazilianDate(dueDateInput) ?? "", event.target.value);
              }}
              required
            />
          </label>
        </div>
        <div className="form-actions">
          <Link className="button button-ghost" to={isEditing ? `/tasks/${id}` : "/tasks"}>Cancelar</Link>
          <button className="button button-primary" disabled={saveTask.isPending || !form.dueAt}>
            {saveTask.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar tarefa"}
          </button>
        </div>
      </form>
    </div>
  );
}
