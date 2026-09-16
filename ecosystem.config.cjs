/**
 * ==============================================================================
 * BURNED NODEJS — PM2 ECOSYSTEM CONFIGURATION
 * ==============================================================================
 * This configuration file controls how PM2 manages, runs, and monitors the
 * Burned Node.js Agent on your server.
 *
 * HOW TO USE:
 *   Start:    pm2 start ecosystem.config.cjs
 *   Status:   pm2 status
 *   Logs:     pm2 logs burned-agent
 *   Restart:  pm2 restart burned-agent
 *   Stop:     pm2 stop burned-agent
 * ==============================================================================
 */

module.exports = {
  apps: [
    {
      // ------------------------------------------------------------------------
      // 1. APPLICATION IDENTIFICATION
      // ------------------------------------------------------------------------
      name: 'burned-agent',

      // Path to the executable agent bundle.
      // - In repo development: 'dist/burned-agent.js'
      // - If deployed as standalone file on server: 'burned-agent.js'
      script: 'dist/burned-agent.js',

      // Keep as 1 instance. The agent uses SQLite and real-time SSE streams,
      // which run best in a single dedicated process.
      instances: 1,
      exec_mode: 'fork',

      // ------------------------------------------------------------------------
      // 2. ENVIRONMENT CONFIGURATION (USER CUSTOMIZABLE)
      // ------------------------------------------------------------------------
      env: {
        NODE_ENV: 'production',

        /**
         * PORT: Port where the web dashboard and API will listen.
         * Default: 27109
         */
        PORT: 27109,

        /**
         * HOST: Network interface to bind to.
         * - '127.0.0.1' : Localhost only (default, best for local/proxy access).
         * - '0.0.0.0'   : Accessible from anywhere (public IP / LAN).
         * Default: '127.0.0.1'
         */
        HOST: '127.0.0.1',

        /**
         * BURNED_DB_PATH: Path to the SQLite database storing credentials & sessions.
         * - Default: './burned.db' (saved in current working directory)
         * - Custom example: '/var/lib/burned.db' or '/etc/burned/burned.db'
         */
        BURNED_DB_PATH: './burned.db',

        /**
         * BURNED_SECRET: (Optional) Static master bypass token.
         * If uncommented and set, allows API requests passing header 'x-burned-token'.
         * Leave commented out to use the built-in SQLite admin login workflow.
         */
        // BURNED_SECRET: 'your-custom-secret-token-here'
      },

      // ------------------------------------------------------------------------
      // 3. RELIABILITY & RESTART POLICIES
      // ------------------------------------------------------------------------
      // Automatically restart process if it crashes
      autorestart: true,

      // Do NOT watch for file changes in production (saves CPU)
      watch: false,

      // Automatically restart the agent if memory exceeds this limit
      max_memory_restart: '150M',

      // Exponential backoff restart delay to prevent CPU thrashing on crashes
      exp_backoff_restart_delay: 100,

      // Maximum restart count within a short window before PM2 considers it errored
      max_restarts: 10,

      // Time (in ms) to wait for graceful shutdown before force killing (SIGKILL)
      kill_timeout: 4000,

      // ------------------------------------------------------------------------
      // 4. LOGGING CONFIGURATION
      // ------------------------------------------------------------------------
      // Prefix all console logs with timestamp: [YYYY-MM-DD HH:mm:ss]
      time: true,

      // Merges cluster logs if instances > 1
      merge_logs: true

      // To write logs to custom files, uncomment the lines below:
      // error_file: './logs/error.log',
      // out_file: './logs/output.log',
    }
  ]
};
