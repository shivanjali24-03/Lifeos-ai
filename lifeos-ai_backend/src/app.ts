import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.js";
import tasksRouter from "./routes/tasks.js";
import authRouter from "./routes/auth.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10kb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication requests. Please try again later." },
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);
app.get("/api/health", (_req, res) => res.json({ success: true, message: "LifeOS AI backend is running!", timestamp: new Date().toISOString() }));
app.use("/api/auth", authRouter);
app.use("/api/tasks", tasksRouter);

export default app;
