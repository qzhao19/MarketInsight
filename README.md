# MarketInsight
AI-driven marketing strategy workflow engine.

## 1. Overview
`MarketInsight` is a project that leverages artificial intelligence to drive marketing strategy workflows. It aims to assist marketers in formulating and executing marketing strategies more efficiently.


## 2. Architecture & Key features

### Technical Stack
*   **Backend Framework:** [NestJS](https://nestjs.com/) (Node.js) for a scalable, modular architecture.
*   **AI Workflow Management:** [LangGraph.js](https://docs.langchain.com/oss/javascript/langgraph/overview) for managing complex, stateful LLM agent workflows.
*   **Asynchronous Processing:** [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/) for robust task queuing and background job execution.
*   **Persistence Layer:** [Prisma ORM](https://www.prisma.io/) with [MySQL](https://www.mysql.com/) for structured data storage and historical tracking.
*   **API Documentation:** [Swagger/OpenAPI](https://swagger.io/) for interactive API exploration and testing.

### System Design
MarketInsight follows a **Producer-Consumer** pattern to handle long-running LLM operations without blocking the main API thread:

*   **Ingestion:** Clients submit campaign requests via JWT-protected REST endpoints.
*   **Persistence & Enqueue:** The system validates input, creates a campaign record in MySQL, and enqueues a background job in BullMQ.
*   **Asynchronous Processing:** A dedicated CampaignProcessor worker dequeues jobs and invokes LangGraph agents to execute the campaign workflow.
*   **Incremental Task Execution:** The agent processes tasks sequentially, persisting intermediate outputs and state transitions to the database in real-time. This enables progress tracking, fault recovery, and result replay.
*   **Result Aggregation & Completion:** Upon finishing all tasks, the system aggregates the final strategy report, updates the campaign status, and makes results available for client retrieval via REST API.

### Core Features
*   **Asynchronous Workflow:** Decouples API responses from heavy LLM processing to ensure high availability.
*   **Stateful Persistence:** Comprehensive, timestamped records of agent reasoning, intermediate outputs, and task status transitions are persisted to support auditability, reproducibility, debugging, and historical analysis.
*   **Multi-Model Extensibility:** A modular adapter layer allows seamless integration of various LLM providers (OpenAI, Deepseek, etc.).
*   **Enterprise-Ready Security:** Built-in JWT authentication, strict DTO validation, and comprehensive error handling.


## 3. Getting Started

### Prerequisites
*   Node.js (v24.11.1+)
*   MySQL 9.5+
*   Redis 8.4+


### Installation
1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/qzhao19/MarketInsight.git
    cd MarketInsight
    ```
2.  **Verify Node.js Version:**
    ```bash
    # If using nvm
    nvm use
    
    # Verify versions
    node --version  # Should be v24.11.1+
    npm --version   # Should be v10.0+
    ```

3.  **Install Dependencies:**
    ```bash
    npm install
    ```

4.  **Environment Setup:**
    MarketInsight uses multiple environment configuration files to organize settings by category. Copy the example files and configure them according to your environment:

    - **Base Configuration (.env.base):**
      Copy `env/.env.base.example` to `.env.base` and configure basic application settings such as `NODE_ENV`, `PORT`, `APP_NAME`, and `APP_VERSION`.

    - **Database Configuration (.env.db):**
      Copy `env/.env.db.example` to `.env.db` and set up your MySQL database connection. Key variables include `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, and `DB_PASSWORD`. Ensure the database exists and the user has appropriate permissions.

    - **LLM Configuration (.env.llm):**
      Copy `env/.env.llm.example` to `.env.llm` and configure LLM-related settings, including circuit breaker parameters, rate limiting, retry logic, model parameters (e.g., `DEFAULT_MODEL_NAME`, `DEFAULT_MODEL_TEMPERATURE`), and workflow timeouts. Adjust these based on your LLM provider's requirements and performance needs.

    - **Secrets and API Keys (.env.secrets):**
      Copy `env/.env.secrets.example` to `.env.secrets` and add your sensitive API keys. This includes `LLM_API_KEY` for your LLM provider (e.g., DeepSeek or OpenAI), `LLM_BASE_URL` for the API endpoint, and `SERPER_API_KEY` for web search functionality. 

    Example configuration for development:
    ```bash
    cp env/.env.base.example .env.base
    cp env/.env.db.example .env.db
    cp env/.env.llm.example .env.llm
    cp env/.env.secrets.example .env.secrets
    # Edit the files with your actual values
    ```

5.  **Database Migration:**
    
    MarketInsight provides an automated database setup script that handles all initialization steps:
    
    ```bash
    # Make the script executable (first time only)
    chmod +x script/setup-db.sh
    
    # Run the automated setup script
    ./script/setup-db.sh
    ```
    
    The script will:
    - Verify MySQL and Node.js installations
    - Execute `script/setup-db.sql` to create the database and user
    - Push Prisma schema to the database (`npm run prisma:push`)
    - Generate Prisma client (`npm run prisma:generate`)
    
    **Manual Setup (Alternative):**
    
    If you prefer to run the steps manually:
    
    ```bash
    # 1. Create database and user
    mysql -u root -p < script/setup-db.sql
    
    # 2. Push Prisma schema to database
    npm run prisma:push
    
    # 3. Generate Prisma client
    npm run prisma:generate
    ```
    
    **Troubleshooting:**
    - If MySQL connection fails, verify your credentials in `.env.db`
    - Ensure MySQL server is running: `brew services start mysql` (macOS) or `sudo systemctl start mysql` (Linux)
    - Check that the database user has appropriate permissions


## 4. Testing
*   **Run Unit Tests:**
    ```bash
    npm test -- tests/*.test.ts
    ```

## 5. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
