require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5000;

console.log("Starting INE Price Tracker backend...");
console.log("PORT:", PORT);

const server = app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});

/*
 * Keep Node process alive.
 *
 * This is useful for local development with
 * nodemon and also helps diagnose unexpected
 * process exits.
 */
const keepAlive = setInterval(() => {
  // Server is intentionally kept alive.
}, 30000);

/*
 * Graceful shutdown
 */
function shutdown(signal) {
  console.log(
    `\n${signal} received. Shutting down server...`
  );

  clearInterval(keepAlive);

  server.close(() => {
    console.log(
      "Server closed."
    );

    process.exit(0);
  });
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

/*
 * Catch unexpected errors.
 */
process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "UNHANDLED REJECTION:",
      reason
    );
  }
);