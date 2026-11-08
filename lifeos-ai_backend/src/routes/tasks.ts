
import { Router, type Request, type Response } from "express";
import { isValidObjectId } from "mongoose";
import { Task } from "../models/Task.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";

const router = Router();

type TaskStatus = "pending" | "in-progress" | "completed";
type TaskPriority = "low" | "medium" | "high";

type TaskUpdates = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
};

// Read the authenticated user ID without changing Express's global types.
function getUserId(req: Request): string | null {
  return (req as AuthenticatedRequest).user?.userId ?? null;
}

// All routes below require a valid JWT.
router.use(requireAuth);

// GET /api/tasks — fetch only the logged-in user's tasks.
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const tasks = await Task.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error("Fetch tasks error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks.",
    });
  }
});

// POST /api/tasks — create a task for the logged-in user.
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const { title, description, priority, dueDate } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({
        success: false,
        message: "Task title is required.",
      });
      return;
    }

    if (title.trim().length > 200) {
      res.status(400).json({
        success: false,
        message: "Task title cannot exceed 200 characters.",
      });
      return;
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.length > 2000)
    ) {
      res.status(400).json({
        success: false,
        message: "Description must be a string of at most 2000 characters.",
      });
      return;
    }

    if (
      priority !== undefined &&
      !["low", "medium", "high"].includes(priority)
    ) {
      res.status(400).json({
        success: false,
        message: "Priority must be low, medium, or high.",
      });
      return;
    }

    let parsedDueDate: Date | null = null;

    if (dueDate !== undefined && dueDate !== null && dueDate !== "") {
      if (
        typeof dueDate !== "string" ||
        Number.isNaN(Date.parse(dueDate))
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide a valid due date.",
        });
        return;
      }

      parsedDueDate = new Date(dueDate);
    }

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() ?? "",
      priority: priority ?? "medium",
      dueDate: parsedDueDate,
      userId,
    });

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("Create task error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create task.",
    });
  }
});

// PATCH /api/tasks/:id — update only the logged-in user's task.
router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const taskId = req.params.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!isValidObjectId(taskId)) {
      res.status(400).json({
        success: false,
        message: "Invalid task ID.",
      });
      return;
    }

    const { title, description, status, priority, dueDate } = req.body;

    // Allow only explicitly supported fields.
    const updates: TaskUpdates = {};

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 200
      ) {
        res.status(400).json({
          success: false,
          message: "Title must be between 1 and 200 characters.",
        });
        return;
      }

      updates.title = title.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        description.length > 2000
      ) {
        res.status(400).json({
          success: false,
          message: "Description must be a string of at most 2000 characters.",
        });
        return;
      }

      updates.description = description.trim();
    }

    if (status !== undefined) {
      if (
        !["pending", "in-progress", "completed"].includes(status)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid task status.",
        });
        return;
      }

      updates.status = status as TaskStatus;
    }

    if (priority !== undefined) {
      if (!["low", "medium", "high"].includes(priority)) {
        res.status(400).json({
          success: false,
          message: "Invalid task priority.",
        });
        return;
      }

      updates.priority = priority as TaskPriority;
    }

    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === "") {
        updates.dueDate = null;
      } else if (
        typeof dueDate === "string" &&
        !Number.isNaN(Date.parse(dueDate))
      ) {
        updates.dueDate = new Date(dueDate);
      } else {
        res.status(400).json({
          success: false,
          message: "Please provide a valid due date.",
        });
        return;
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
      return;
    }

    const task = await Task.findOneAndUpdate(
      {
        _id: taskId,
        userId,
      },
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!task) {
      res.status(404).json({
        success: false,
        message: "Task not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("Update task error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update task.",
    });
  }
});

// DELETE /api/tasks/:id — delete only the logged-in user's task.
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const taskId = req.params.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!isValidObjectId(taskId)) {
      res.status(400).json({
        success: false,
        message: "Invalid task ID.",
      });
      return;
    }

    const task = await Task.findOneAndDelete({
      _id: taskId,
      userId,
    });

    if (!task) {
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
});

export default router;
