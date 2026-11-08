
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import { connectDatabase } from "./config/database.js";
import tasksRouter from "./routes/tasks.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// 1. Security headers
app.disable("x-powered-by");
app.use(helmet());

// 2. Allow requests from your frontend
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// 3. Limit request body size
app.use(express.json({ limit: "10kb" }));

// 4. General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// 5. Stricter authentication rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many authentication requests. Please try again later.",
  },
});

// 6. Apply rate limits BEFORE mounting API routes
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// 7. Health check
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "LifeOS AI backend is running!",
    timestamp: new Date().toISOString(),
  });
});

// 8. API routes
app.use("/api/auth", authRouter);
app.use("/api/tasks", tasksRouter);

// 9. Start server after database connection
async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(
        `LifeOS AI backend running on http://localhost:${PORT}`,
      );
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

void startServer();
