import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";

const router = Router();

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

function createToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

const publicUserSelect = { id: true, name: true, email: true } as const;

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Name, valid email, and password (8–128 characters) are required.",
    });
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: publicUserSelect,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token: createToken(user.id),
      user,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error("Signup error:", error);
    return res.status(500).json({ success: false, message: "Unable to create account." });
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.trim().toLowerCase() },
      select: { ...publicUserSelect, passwordHash: true },
    });

    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return res.json({
      success: true,
      message: "Login successful.",
      token: createToken(user.id),
      user: publicUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Unable to log in." });
  }
});

export default router;
