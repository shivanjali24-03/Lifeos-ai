
import { useState, type FormEvent } from "react";
import { login, signup, type AuthResponse } from "../api/auth";
import "./Auth.css";

type AuthProps = {
  onAuthenticated: (result: AuthResponse) => void;
};

export default function Auth({ onAuthenticated }: AuthProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "signup") {
      if (name.trim().length < 2) {
        setError("Please enter your name.");
        return;
      }

      if (password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      const result =
        mode === "signup"
          ? await signup({
              name: name.trim(),
              email: normalizedEmail,
              password,
            })
          : await login({
              email: normalizedEmail,
              password,
            });

      onAuthenticated(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode((current) => (current === "login" ? "signup" : "login"));
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">✦</div>
          <div>
            <h1>LIFEOS AI</h1>
            <p>YOUR PERSONAL INTELLIGENCE SYSTEM</p>
          </div>
        </div>

        <div className="auth-heading">
          <span className="auth-eyebrow">SYSTEM ACCESS</span>
          <h2>
            {mode === "login" ? "Welcome back." : "Create your account."}
          </h2>
          <p>
            {mode === "login"
              ? "Sign in to continue to your command center."
              : "Start building a smarter, more intentional life."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <label>
              Full name
              <input
                type="text"
                autoComplete="name"
                placeholder="Enter your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <div className="auth-password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === "signup" ? 8 : undefined}
                maxLength={128}
              />
              <button
                type="button"
                className="auth-show-password"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {mode === "signup" && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                maxLength={128}
              />
            </label>
          )}

          {error && (
            <p className="auth-alert auth-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="auth-alert auth-success" role="status">
              {message}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in →"
                : "Create account →"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? "New to LifeOS AI?" : "Already have an account?"}
          <button type="button" onClick={switchMode}>
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>

        <p className="auth-footer">
          PERSONAL DATA · SECURE ACCESS · BUILT FOR YOU
        </p>
      </section>
    </main>
  );
}
