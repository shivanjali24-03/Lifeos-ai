
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma, type Task } from "@prisma/client";
import { prisma } from "../config/database.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

const titleSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().max(2000);
const statusSchema = z.enum(["pending", "in-progress", "completed"]);
const prioritySchema = z.enum(["low", "medium", "high"]);
const dueDateSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.literal(""))
  .nullable();
const uuidSchema = z.string().uuid();

function getUserId(req: Request): string | null {
  return (req as AuthenticatedRequest).user?.userId ?? null;
}

function toApiTask(task: Task) {
  const status = {
    PENDING: "pending",
    IN_PROGRESS: "in-progress",
    COMPLETED: "completed",
  } as const;

  const priority = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
  } as const;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: status[task.status],
    priority: priority[task.priority],
    dueDate: task.dueDate?.toISOString() ?? null,
    userId: task.userId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function apiStatusToDb(
  status: z.infer<typeof statusSchema>
): Task["status"] {
  const mapping = {
    pending: "PENDING",
    "in-progress": "IN_PROGRESS",
    completed: "COMPLETED",
  } as const;

  return mapping[status];
}

function apiPriorityToDb(
  priority: z.infer<typeof prioritySchema>
): Task["priority"] {
  const mapping = {
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
  } as const;

  return mapping[priority];
}

function getValidTaskId(
  req: Request,
  res: Response
): string | null {
  const id: unknown = req.params.id;

  if (typeof id !== "string" || !uuidSchema.safeParse(id).success) {
    res.status(400).json({
      success: false,
      message: "Invalid task ID.",
    });
    return null;
  }

  return id;
}

// GET /api/tasks
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  try {
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: tasks.map(toApiTask),
    });
  } catch (error) {
    console.error("Fetch tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks.",
    });
  }
});

const createTaskSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: dueDateSchema.optional(),
});

// POST /api/tasks
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  const parsed = createTaskSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    let message = "Task title is required.";

    if (issue?.path[0] === "title" && issue.code === "too_big") {
      message = "Task title cannot exceed 200 characters.";
    } else if (issue?.path[0] === "description") {
      message = "Description must be a string of at most 2000 characters.";
    } else if (issue?.path[0] === "priority") {
      message = "Priority must be low, medium, or high.";
    } else if (issue?.path[0] === "dueDate") {
      message = "Please provide a valid due date.";
    }

    res.status(400).json({ success: false, message });
    return;
  }

  try {
    const { title, description, priority, dueDate } = parsed.data;

    const task = await prisma.task.create({
      data: {
        title,
        description: description?.trim() ?? "",
        priority: priority ? apiPriorityToDb(priority) : "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        userId,
      },
    });

    res.status(201).json({
      success: true,
      data: toApiTask(task),
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create task.",
    });
  }
});

const updateTaskSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: dueDateSchema.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one valid field to update."
  );

// PATCH /api/tasks/:id
router.patch(
  "/:id",
  async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const id = getValidTaskId(req, res);
    if (!id) return;

    const parsed = updateTaskSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      let message = "Provide at least one valid field to update.";

      if (issue?.path[0] === "title") {
        message = "Title must be between 1 and 200 characters.";
      } else if (issue?.path[0] === "description") {
        message = "Description must be a string of at most 2000 characters.";
      } else if (issue?.path[0] === "status") {
        message = "Invalid task status.";
      } else if (issue?.path[0] === "priority") {
        message = "Invalid task priority.";
      } else if (issue?.path[0] === "dueDate") {
        message = "Please provide a valid due date.";
      }

      res.status(400).json({ success: false, message });
      return;
    }

    try {
      const input = parsed.data;
      const data: Prisma.TaskUpdateInput = {};

      if (input.title !== undefined) {
        data.title = input.title;
      }

      if (input.description !== undefined) {
        data.description = input.description.trim();
      }

      if (input.status !== undefined) {
        data.status = apiStatusToDb(input.status);
      }

      if (input.priority !== undefined) {
        data.priority = apiPriorityToDb(input.priority);
      }

      if (input.dueDate !== undefined) {
        data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }

      // Verify ownership before updating.
      const existingTask = await prisma.task.findFirst({
        where: { id, userId },
      });

      if (!existingTask) {
        res.status(404).json({
          success: false,
          message: "Task not found.",
        });
        return;
      }

      // id is unique; ownership was verified above.
      const updatedTask = await prisma.task.update({
        where: { id },
        data,
      });

      res.status(200).json({
        success: true,
        data: toApiTask(updatedTask),
      });
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update task.",
      });
    }
  }
);

// DELETE /api/tasks/:id
router.delete(
  "/:id",
  async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const id = getValidTaskId(req, res);
    if (!id) return;

    try {
      // Delete only if this task belongs to the authenticated user.
      const result = await prisma.task.deleteMany({
        where: { id, userId },
      });

      if (result.count === 0) {
        res.status(404).json({
          success: false,
          message: "Task not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Task deleted successfully.",
      });
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete task.",
      });
    }
  }
);

export default router;
