import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { connectDatabase, prisma } from "../config/database.js";

async function signup(name: string, email: string) {
  return request(app).post("/api/auth/signup").send({ name, email, password: "StrongPassword123" });
}

async function tokenFor(name: string, email: string): Promise<string> {
  const response = await signup(name, email);
  expect(response.status).toBe(201);
  return response.body.token as string;
}

beforeAll(async () => {
  await connectDatabase();
});

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("authentication", () => {
  it("signs up without returning the password hash", async () => {
    const response = await signup("Test User", "test@example.com");
    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ name: "Test User", email: "test@example.com" });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("returns 409 for a duplicate email", async () => {
    await signup("Test User", "duplicate@example.com");
    const response = await signup("Another User", "duplicate@example.com");
    expect(response.status).toBe(409);
    expect(response.body.message).toBe("An account with this email already exists.");
  });

  it("logs in with valid credentials", async () => {
    await signup("Test User", "login@example.com");
    const response = await request(app).post("/api/auth/login").send({ email: "LOGIN@example.com", password: "StrongPassword123" });
    expect(response.status).toBe(200);
    expect(response.body.user.passwordHash).toBeUndefined();
  });
});

describe("tasks", () => {
  it("supports create, list, update, and delete", async () => {
    const token = await tokenFor("Task Owner", "owner@example.com");
    const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${token}`).send({ title: "Write tests", status: "pending", priority: "high" });
    expect(created.status).toBe(201);
    expect(created.body.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.body.data.title).toBe("Write tests");

    const id = created.body.data.id as string;
    const list = await request(app).get("/api/tasks").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const updated = await request(app).patch(`/api/tasks/${id}`).set("Authorization", `Bearer ${token}`).send({ status: "in-progress" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe("in-progress");

    const deleted = await request(app).delete(`/api/tasks/${id}`).set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    const missing = await request(app).delete(`/api/tasks/${id}`).set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });

  it("rejects access to another user's task", async () => {
    const ownerToken = await tokenFor("Owner", "owner2@example.com");
    const otherToken = await tokenFor("Other", "other@example.com");
    const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${ownerToken}`).send({ title: "Private task" });
    const id = created.body.data.id as string;

    const read = await request(app).patch(`/api/tasks/${id}`).set("Authorization", `Bearer ${otherToken}`).send({ title: "Stolen" });
    expect(read.status).toBe(404);
    const deleted = await request(app).delete(`/api/tasks/${id}`).set("Authorization", `Bearer ${otherToken}`);
    expect(deleted.status).toBe(404);
    const ownerList = await request(app).get("/api/tasks").set("Authorization", `Bearer ${ownerToken}`);
    expect(ownerList.body.data[0].title).toBe("Private task");
  });

  it("validates task IDs as UUIDs", async () => {
    const token = await tokenFor("Owner", "uuid@example.com");
    const response = await request(app).delete("/api/tasks/not-a-uuid").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid task ID.");
  });
});
