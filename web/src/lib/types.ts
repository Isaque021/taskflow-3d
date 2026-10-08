export type Role = "admin" | "member";
export type UserStatus = "active" | "inactive";
export type Category = "market" | "car" | "work";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  organizationId: string;
  createdAt: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: User;
  organization: Organization;
};

export type Task = {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  dueAt: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responsibleUserId: string | null;
  responsible: { id: string; name: string | null } | null;
  overdue: boolean;
  subtasks?: { total: number; completed: number };
};

export type Subtask = {
  id: string;
  taskId: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export const categoryLabels: Record<Category, string> = {
  market: "Mercado",
  car: "Carro",
  work: "Trabalho",
};
