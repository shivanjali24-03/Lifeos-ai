
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

export type ApiTask = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed";
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  success: boolean;
  data: ApiTask[];
};

type SingleTaskResponse = {
  success: boolean;
  data: ApiTask;
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("lifeos_token");

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getTasks(): Promise<ApiTask[]> {
  const response = await request<ApiResponse>("/tasks");
  return response.data;
}

export async function createTask(title: string): Promise<ApiTask> {
  const response = await request<SingleTaskResponse>("/tasks", {
    method: "POST",
    body: JSON.stringify({
      title,
      description: "",
      priority: "medium",
    }),
  });

  return response.data;
}

export async function updateTask(
  id: string,
  updates: Partial<
    Pick<
      ApiTask,
      "title" | "description" | "status" | "priority" | "dueDate"
    >
  >,
): Promise<ApiTask> {
  const response = await request<SingleTaskResponse>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });

  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await request<unknown>(`/tasks/${id}`, {
    method: "DELETE",
  });
}
