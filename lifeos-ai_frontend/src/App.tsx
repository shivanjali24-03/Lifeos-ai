
import { useEffect, useMemo, useState } from "react";
import Auth from "./components/Auth";
import type { AuthResponse } from "./api/auth";
import {
  getTasks,
  createTask,
  updateTask,
  type ApiTask,
} from "./api/tasks";
import "./App.css";

type Category = "Work" | "Personal" | "Health";

type Task = {
  id: string;
  title: string;
  category: Category;
  time: string;
  completed: boolean;
};

type Page =
  | "Command Center"
  | "Tasks"
  | "Plans"
  | "Projects"
  | "Notes"
  | "Focus"
  | "Wellbeing"
  | "Settings";

function mapApiTask(task: ApiTask): Task {
  return {
    id: task._id,
    title: task.title,
    category: "Personal",
    time: task.dueDate
      ? new Date(task.dueDate).toLocaleString()
      : "Anytime",
    completed: task.status === "completed",
  };
}

const navigation: { label: Page; icon: string }[] = [
  { label: "Command Center", icon: "⌂" },
  { label: "Tasks", icon: "☑" },
  { label: "Plans", icon: "▤" },
  { label: "Projects", icon: "◈" },
  { label: "Notes", icon: "▧" },
  { label: "Focus", icon: "◎" },
  { label: "Wellbeing", icon: "♡" },
  { label: "Settings", icon: "⚙" },
];

const quickActions = [
  { label: "Plan My Day", icon: "▦", prompt: "Plan my day" },
  { label: "Start Focus", icon: "◎", prompt: "Start focus" },
  {
    label: "Boost Productivity",
    icon: "ϟ",
    prompt: "Boost productivity",
  },
  {
    label: "Review Progress",
    icon: "▥",
    prompt: "Review progress",
  },
  {
    label: "Wellbeing Check",
    icon: "❧",
    prompt: "Wellbeing check",
  },
  {
    label: "Get Suggestions",
    icon: "♧",
    prompt: "Give me suggestions",
  },
];

function App() {

    const [authToken, setAuthToken] = useState<string | null>(
    () => sessionStorage.getItem("lifeos_token")
  );

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(() => {
    const savedUser = sessionStorage.getItem("lifeos_user");

    if (!savedUser) return null;

    try {
      return JSON.parse(savedUser);
    } catch {
      sessionStorage.removeItem("lifeos_user");
      return null;
    }
  });

  function handleAuthenticated(result: AuthResponse) {
    sessionStorage.setItem("lifeos_token", result.token);
    sessionStorage.setItem("lifeos_user", JSON.stringify(result.user));

    setCurrentUser(result.user);
    setAuthToken(result.token);
    setNotice("");
  }

  function handleLogout() {
    sessionStorage.removeItem("lifeos_token");
    sessionStorage.removeItem("lifeos_user");

    setAuthToken(null);
    setCurrentUser(null);
    setTasks([]);
    setTasksLoading(false);
    setTimerRunning(false);
    setActivePage("Command Center");
    setNotice("");
  }
  const [activePage, setActivePage] =
    useState<Page>("Command Center");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("lifeos-theme");
      return saved === "light" || saved === "dark"
        ? saved
        : "dark";
    } catch {
      return "dark";
    }
  });

  const [command, setCommand] = useState("");
  const [assistantMessage, setAssistantMessage] = useState(
    "I'm online and ready. What would you like to accomplish?"
  );
  const [notice, setNotice] = useState("");

  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [focusSessions, setFocusSessions] = useState(0);
  const [focusSeconds, setFocusSeconds] = useState(0);

  // Load tasks from the Express API backed by MongoDB.
 
  // Load only the authenticated user's tasks.
  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      if (!authToken) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      setTasksLoading(true);

      try {
        const apiTasks = await getTasks();

        if (!cancelled) {
          setTasks(apiTasks.map(mapApiTask));
          setNotice("");
        }
      } catch (error) {
        console.error("Failed to load tasks:", error);

        if (!cancelled) {
          setTasks([]);
          setNotice(
            "Could not load tasks. Your session may have expired, or the backend may be unavailable."
          );
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    }

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, [authToken]);


  // Keep the selected theme between page refreshes.
  useEffect(() => {
    try {
      localStorage.setItem("lifeos-theme", theme);
    } catch (error) {
      console.error("Could not save theme preference:", error);
    }
  }, [theme]);

  // Focus timer.
  useEffect(() => {
    if (!timerRunning) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((remaining) => {
        if (remaining <= 1) {
          window.clearInterval(timer);
          setTimerRunning(false);
          setFocusSessions((count) => count + 1);
          setNotice("Focus session complete. Excellent work!");
          return 0;
        }

        setFocusSeconds((total) => total + 1);
        return remaining - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const completedTasks = tasks.filter(
    (task) => task.completed
  ).length;

  const remainingTasks = tasks.length - completedTasks;

  const progress = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  const focusMinutes = Math.floor(focusSeconds / 60);

  const timeLabel = useMemo(() => {
    const date = new Date();

    return {
      greeting:
        date.getHours() < 12
          ? "Good morning"
          : date.getHours() < 18
            ? "Good afternoon"
            : "Good evening",

      weekday: date.toLocaleDateString("en-US", {
        weekday: "long",
      }),

      fullDate: date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };
  }, []);

  // Update task completion in MongoDB.
  async function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);

    if (!task) return;

    const previousCompleted = task.completed;
    const newCompleted = !previousCompleted;

    // Update the UI immediately.
    setTasks((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, completed: newCompleted }
          : item
      )
    );

    try {
      const updatedTask = await updateTask(id, {
        status: newCompleted ? "completed" : "pending",
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === id ? mapApiTask(updatedTask) : item
        )
      );
    } catch (error) {
      console.error("Failed to update task:", error);

      // Restore the previous state if the request fails.
      setTasks((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, completed: previousCompleted }
            : item
        )
      );

      setNotice("Could not update the task. Please try again.");
    }
  }

  // Create and save a task in MongoDB.
  async function addTask() {
    const title = window.prompt("What would you like to do?");

    if (!title?.trim()) return;

    try {
      const savedTask = await createTask(title.trim());

      setTasks((current) => [
        mapApiTask(savedTask),
        ...current,
      ]);

      setNotice(`Added task: ${savedTask.title}`);
    } catch (error) {
      console.error("Failed to create task:", error);

      setNotice(
        "Could not save the task. Check your backend connection."
      );
    }
  }

  function runCommand(rawCommand: string) {
    const text = rawCommand.trim().toLowerCase();

    if (!text) return;

    setCommand("");
    setNotice("");

    if (text.includes("focus") || text.includes("pomodoro")) {
      setActivePage("Focus");
      setTimerRunning(true);

      setAssistantMessage(
        "Focus mode is ready. One task, one clear mind. Your 45-minute session has started."
      );

      setNotice("Focus session started.");
    } else if (
      text.includes("task") ||
      text.includes("todo")
    ) {
      setActivePage("Tasks");

      setAssistantMessage(
        `You have ${remainingTasks} task${
          remainingTasks === 1 ? "" : "s"
        } remaining. Let's take them one at a time.`
      );
    } else if (
      text.includes("progress") ||
      text.includes("review")
    ) {
      setActivePage("Command Center");

      setAssistantMessage(
        `You're ${progress}% through your task list: ${completedTasks} complete and ${remainingTasks} remaining. Keep your momentum going.`
      );
    } else if (
      text.includes("wellbeing") ||
      text.includes("health") ||
      text.includes("break")
    ) {
      setActivePage("Wellbeing");

      setAssistantMessage(
        "A quick check-in: hydrate, relax your shoulders, and take a few slow breaths. How are your energy and mood today?"
      );
    } else if (
      text.includes("plan") ||
      text.includes("day")
    ) {
      setActivePage("Command Center");

      setAssistantMessage(
        `Here's your day at a glance: ${remainingTasks} tasks remain. Start with your next priority, then take a short reset between tasks.`
      );
    } else if (
      text.includes("suggest") ||
      text.includes("productivity")
    ) {
      setAssistantMessage(
        "JARVIS suggestion: choose one important task, silence distractions, and work for 25–45 minutes before reviewing your progress."
      );
    } else if (text.includes("note")) {
      setActivePage("Notes");

      setAssistantMessage(
        "Notes workspace selected. Capture the idea you don't want to lose."
      );
    } else {
      setAssistantMessage(
        "I can help you plan your day, open tasks, start a focus session, review progress, or check in on wellbeing. AI-backed answers can be connected to your backend next."
      );
    }
  }

  function handleQuickAction(prompt: string) {
    if (prompt.toLowerCase().includes("focus")) {
      setSecondsLeft(45 * 60);
      setTimerRunning(true);
    }

    runCommand(prompt);
  }

  function formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");

    const seconds = (totalSeconds % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${seconds}`;
  }

  const pageTitle =
    activePage === "Command Center"
      ? "JARVIS Command Center"
      : activePage;

  if (!authToken || !currentUser) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className={`lifeos-layout ${theme}`}>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => setActivePage("Command Center")}
          aria-label="Go to JARVIS command center"
        >
          <span className="brand-mark">
            <span>✳</span>
          </span>

          <span className="brand-copy">
            <strong>JARVIS</strong>
            <small>AI COMMAND CENTER</small>
          </span>
        </button>

        <div className="sidebar-label">Workspace</div>

        <nav className="navigation" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${
                activePage === item.label ? "active" : ""
              }`}
              onClick={() => setActivePage(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>

              {item.label === "Tasks" &&
                remainingTasks > 0 && (
                  <span className="nav-count">
                    {remainingTasks}
                  </span>
                )}
            </button>
          ))}
        </nav>

        <div className="system-card">
          <div className="mini-reactor">
            <span />
          </div>

          <div className="system-online">
            <i /> System Online
          </div>

          <p>All modules operational</p>

          <div className="system-modules">
            <span>AI Core</span>
            <b>ONLINE</b>
          </div>

          <div className="system-modules">
            <span>Productivity</span>
            <b>ONLINE</b>
          </div>
        </div>

        <button
          className="profile"
          onClick={() => setActivePage("Settings")}
        >
          <span className="avatar">
            {currentUser.name.charAt(0).toUpperCase()}
          </span>

          <span className="profile-text">
            <strong>{currentUser.name}</strong>
            <small>{currentUser.email}</small>
          </span>

          <span className="profile-menu">···</span>
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-dot">◆</span>
            LifeOS AI <span className="slash">/</span> {activePage}
          </div>

          <form
            className="jarvis-command"
            onSubmit={(event) => {
              event.preventDefault();
              runCommand(command);
            }}
          >
            <span className="command-symbol">✧</span>

            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Ask Jarvis anything... (e.g. Plan my day, focus for 45 min)"
              aria-label="Ask Jarvis"
            />

            <button
              type="submit"
              className="command-submit"
              aria-label="Send command"
            >
              ↗
            </button>
          </form>

          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => setNotice("You're all caught up!")}
            >
              ♧
            </button>

            <button
              className="icon-button"
              aria-label="Toggle theme"
              title="Toggle theme"
              onClick={() =>
                setTheme((current) =>
                  current === "dark" ? "light" : "dark"
                )
              }
            >
              {theme === "dark" ? "☼" : "☾"}
            </button>

            <button
              className="avatar small-avatar"
              onClick={() => setActivePage("Settings")}
              aria-label="Open settings"
              title={`Signed in as ${currentUser.name}`}
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </button>

            <button
              className="icon-button"
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              ⇥
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice-banner" role="status">
            <span>✦</span>
            {notice}

            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {activePage === "Command Center" ? (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <p className="eyebrow">
                  PERSONAL AI · SYSTEM ONLINE
                </p>

                <h1>
                  {timeLabel.greeting}.<br />
                  <span>What shall we do today?</span>
                </h1>

                <p className="hero-description">
                  I'm online, analyzing your goals, tasks, and schedule.
                </p>

                <div className="hero-status">
                  <i /> JARVIS IS READY <span>•</span> ALL SYSTEMS
                  NOMINAL
                </div>
              </div>

              <div
                className="reactor-stage"
                aria-label="JARVIS AI core visual"
              >
                <div className="reactor-grid" />
                <div className="reactor-ring ring-outer" />
                <div className="reactor-ring ring-mid" />
                <div className="reactor-ring ring-inner" />

                <div className="reactor-core">
                  <span className="core-wave">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>

                  <strong>JARVIS</strong>
                  <small>YOUR PERSONAL AI</small>
                </div>

                <span className="reactor-orbit orbit-one" />
                <span className="reactor-orbit orbit-two" />
              </div>

              <div className="hero-date">
                <span className="date-icon">▦</span>

                <span>
                  <strong>{timeLabel.weekday}</strong>
                  <small>{timeLabel.fullDate}</small>
                </span>
              </div>

              <div className="hero-system-list">
                <div>
                  <i /> <span>AI Core</span> <b>Online</b>
                </div>
                <div>
                  <i /> <span>Productivity</span> <b>Online</b>
                </div>
                <div>
                  <i /> <span>Planner</span> <b>Online</b>
                </div>
                <div>
                  <i /> <span>Wellbeing</span> <b>Online</b>
                </div>
              </div>
            </section>

            <section
              className="quick-actions"
              aria-label="JARVIS quick actions"
            >
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="quick-action"
                  onClick={() => handleQuickAction(action.prompt)}
                >
                  <span className="quick-icon">{action.icon}</span>
                  <strong>{action.label}</strong>
                </button>
              ))}
            </section>

            <section
              className="command-response"
              aria-live="polite"
            >
              <span className="response-icon">✧</span>

              <div>
                <strong>JARVIS</strong>
                <p>{assistantMessage}</p>
              </div>

              <span className="response-status">
                <i /> READY
              </span>
            </section>

            <section className="dashboard-grid">
              <article className="panel focus-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">
                      DEEP WORK PROTOCOL
                    </p>
                    <h2>Today's Focus</h2>
                  </div>

                  <span className="live-pill">
                    <i /> LIVE
                  </span>
                </div>

                <div className="focus-layout">
                  <div
                    className={`focus-timer ${
                      timerRunning ? "is-running" : ""
                    }`}
                  >
                    <svg
                      viewBox="0 0 180 180"
                      role="img"
                      aria-label={`Focus timer ${formatTime(secondsLeft)}`}
                    >
                      <circle
                        className="timer-track"
                        cx="90"
                        cy="90"
                        r="78"
                      />

                      <circle
                        className="timer-progress"
                        cx="90"
                        cy="90"
                        r="78"
                        style={{
                          strokeDashoffset: `${
                            490 * (1 - secondsLeft / (45 * 60))
                          }`,
                        }}
                      />
                    </svg>

                    <div className="timer-center">
                      <strong>{formatTime(secondsLeft)}</strong>
                      <small>Focus Session</small>

                      <button
                        onClick={() =>
                          setTimerRunning((running) => !running)
                        }
                        aria-label={
                          timerRunning
                            ? "Pause focus timer"
                            : "Start focus timer"
                        }
                      >
                        {timerRunning ? "Ⅱ" : "▶"}
                      </button>
                    </div>
                  </div>

                  <div className="focus-details">
                    <div>
                      <span>⌁</span>
                      <p>
                        <strong>Deep Work</strong>
                        <small>One priority at a time</small>
                      </p>
                    </div>

                    <div>
                      <span>♫</span>
                      <p>
                        <strong>Ambient Mode</strong>
                        <small>Reduce distractions</small>
                      </p>
                    </div>

                    <div>
                      <span>☕</span>
                      <p>
                        <strong>Take a reset</strong>
                        <small>Breaks are productive</small>
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={() => {
                        setSecondsLeft(45 * 60);
                        setTimerRunning(false);
                      }}
                    >
                      Reset timer ↺
                    </button>
                  </div>
                </div>
              </article>

              <article className="panel tasks-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">
                      MISSION CHECKLIST
                    </p>
                    <h2>Today's Tasks</h2>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActivePage("Tasks")}
                  >
                    View all ↗
                  </button>
                </div>

                <div className="task-panel-summary">
                  <span>
                    {completedTasks} of {tasks.length} completed
                  </span>

                  <div className="mini-progress">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="task-list">
                  {tasksLoading ? (
                    <p className="muted-copy">Loading tasks...</p>
                  ) : tasks.length === 0 ? (
                    <p className="muted-copy">
                      No tasks yet. Add your first task to get started.
                    </p>
                  ) : (
                    tasks.slice(0, 5).map((task) => (
                      <label
                        key={task.id}
                        className={`task-row ${
                          task.completed ? "task-completed" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(task.id)}
                        />

                        <span className="task-copy">
                          <strong>{task.title}</strong>
                          <small>{task.time}</small>
                        </span>

                        <span
                          className={`category-tag ${task.category.toLowerCase()}`}
                        >
                          {task.category}
                        </span>
                      </label>
                    ))
                  )}
                </div>

                <button
                  className="add-task-button"
                  onClick={addTask}
                  disabled={tasksLoading}
                >
                  <span>＋</span> Add a task
                </button>
              </article>

              <article className="panel progress-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">
                      PERFORMANCE OVERVIEW
                    </p>
                    <h2>Daily Progress</h2>
                  </div>

                  <strong className="progress-percent">
                    {progress}%
                  </strong>
                </div>

                <div className="large-progress">
                  <span style={{ width: `${progress}%` }} />
                </div>

                <div className="progress-caption">
                  <span>{completedTasks} completed</span>
                  <span>{remainingTasks} remaining</span>
                </div>

                <div className="progress-metrics">
                  <div>
                    <span className="metric-icon completed-icon">
                      ✓
                    </span>
                    <strong>{completedTasks}</strong>
                    <small>Completed</small>
                  </div>

                  <div>
                    <span className="metric-icon">◷</span>
                    <strong>{remainingTasks}</strong>
                    <small>Remaining</small>
                  </div>

                  <div>
                    <span className="metric-icon streak-icon">
                      ϟ
                    </span>
                    <strong>{focusSessions}</strong>
                    <small>Focus sessions</small>
                  </div>
                </div>
              </article>
            </section>

            <footer className="page-footer">
              <span>
                <i /> JARVIS SYSTEMS OPERATIONAL
              </span>

              <span>
                Build a life that feels like yours <b>✦</b>
              </span>
            </footer>
          </>
        ) : activePage === "Tasks" ? (
          <section className="page-view">
            <div className="page-title-row">
              <div>
                <p className="eyebrow">MISSION CONTROL</p>
                <h1>My Tasks</h1>
                <p>Every completed task moves you forward.</p>
              </div>

              <button
                className="primary-button"
                onClick={addTask}
                disabled={tasksLoading}
              >
                ＋ Add task
              </button>
            </div>

            <div className="panel full-panel">
              <div className="panel-heading">
                <div>
                  <h2>Task checklist</h2>
                  <p>
                    {completedTasks} completed · {remainingTasks}{" "}
                    remaining
                  </p>
                </div>

                <strong className="progress-percent">
                  {progress}%
                </strong>
              </div>

              <div className="task-list">
                {tasksLoading ? (
                  <p className="muted-copy">Loading tasks...</p>
                ) : tasks.length === 0 ? (
                  <p className="muted-copy">
                    Your task list is empty. Add a task to begin.
                  </p>
                ) : (
                  tasks.map((task) => (
                    <label
                      key={task.id}
                      className={`task-row ${
                        task.completed ? "task-completed" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task.id)}
                      />

                      <span className="task-copy">
                        <strong>{task.title}</strong>
                        <small>{task.time}</small>
                      </span>

                      <span
                        className={`category-tag ${task.category.toLowerCase()}`}
                      >
                        {task.category}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : activePage === "Focus" ? (
          <section className="page-view focus-page">
            <p className="eyebrow">DEEP WORK PROTOCOL</p>
            <h1>Focus Mode</h1>

            <p className="page-subtitle">
              Quiet the noise. Give one meaningful task your full
              attention.
            </p>

            <div className="panel focus-page-panel">
              <div
                className={`focus-timer large-timer ${
                  timerRunning ? "is-running" : ""
                }`}
              >
                <svg viewBox="0 0 180 180">
                  <circle
                    className="timer-track"
                    cx="90"
                    cy="90"
                    r="78"
                  />

                  <circle
                    className="timer-progress"
                    cx="90"
                    cy="90"
                    r="78"
                    style={{
                      strokeDashoffset: `${
                        490 * (1 - secondsLeft / (45 * 60))
                      }`,
                    }}
                  />
                </svg>

                <div className="timer-center">
                  <strong>{formatTime(secondsLeft)}</strong>
                  <small>Focus Session</small>
                </div>
              </div>

              <div className="timer-controls">
                <button
                  className="primary-button"
                  onClick={() =>
                    setTimerRunning((running) => !running)
                  }
                >
                  {timerRunning
                    ? "Ⅱ Pause session"
                    : "▶ Start session"}
                </button>

                <button
                  className="secondary-button"
                  onClick={() => {
                    setSecondsLeft(45 * 60);
                    setTimerRunning(false);
                  }}
                >
                  Reset 45 minutes
                </button>
              </div>

              <p className="muted-copy">
                Completed sessions: {focusSessions} · Focus time:{" "}
                {focusMinutes} minutes
              </p>
            </div>
          </section>
        ) : activePage === "Wellbeing" ? (
          <section className="page-view">
            <p className="eyebrow">PERSONAL WELLBEING</p>
            <h1>Check in with yourself.</h1>

            <p className="page-subtitle">
              A small pause can help you reset and move forward.
            </p>

            <div className="wellbeing-grid">
              {[
                {
                  icon: "♡",
                  title: "How is your energy?",
                  text: "Take a moment to notice how you feel.",
                },
                {
                  icon: "☼",
                  title: "Take a breathing break",
                  text: "Relax your shoulders and take five slow breaths.",
                },
                {
                  icon: "⌁",
                  title: "Hydration reminder",
                  text: "Have a glass of water before your next focus session.",
                },
              ].map((item) => (
                <article
                  className="panel wellbeing-card"
                  key={item.title}
                >
                  <span className="quick-icon">{item.icon}</span>
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      setNotice(
                        "Check-in complete. Thanks for taking a moment for yourself."
                      )
                    }
                  >
                    Done ✓
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="page-view">
            <p className="eyebrow">LIFEOS AI WORKSPACE</p>
            <h1>{pageTitle}</h1>

            <p className="page-subtitle">
              Your {activePage.toLowerCase()} workspace is ready for
              the next stage of your LifeOS build.
            </p>

            <div className="panel full-panel workspace-panel">
              <span className="workspace-symbol">
                {navigation.find(
                  (item) => item.label === activePage
                )?.icon ?? "✧"}
              </span>

              <h2>{activePage} module</h2>

              <p>
                This module is a placeholder for now. Your command
                center, tasks, and focus timer are functional.
              </p>

              <button
                className="primary-button"
                onClick={() => setActivePage("Command Center")}
              >
                ← Back to Command Center
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;