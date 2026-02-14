# DeepStock Research Engine

A research-only stock analysis engine that automatically collects, scores, and generates trading signals without broker execution. Provides timing insights with research-quality analysis.

## Features

- **Signal Collection**: Gather signals from multiple sources (Reddit, StockTwits, SEC, News, Crypto)
- **Signal Scoring**: Weight and normalize collected signals for reproducibility
- **AI-Powered Decisions**: Generate buy/hold/sell decisions with confidence levels
- **Daily Reports**: Create comprehensive daily summaries with themes and risks
- **Multi-Market Support**: US and Korean markets with specialized data sources
- **Research-Only**: Designed for analysis without broker execution
- **Modular Pipeline**: Independent stages with timeboxing and safety guards

## Architecture

```
├── app/                 # Next.js frontend
│   ├── api/             # API routes
│   └── dashboard/       # Dashboard UI components
├── src/                 # Core application logic
│   ├── adapters/        # Database and external service adapters
│   ├── config/          # Configuration and limits
│   ├── core/            # Core pipeline and domain logic
│   └── utils/           # Utility functions
└── scripts/             # Development and maintenance scripts
```

### Pipeline Stages

1. **Gather**: Collect signals from various sources
2. **Normalize**: Standardize and enrich signal data
3. **Score**: Evaluate signal importance and relevance
4. **Decide**: Generate AI-powered trading decisions
5. **Report**: Create daily summary reports

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/deepstock-research-only.git
cd deepstock-research-only

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

## Configuration

### Environment Variables

```env
# Market configuration
DEFAULT_MARKET_SCOPE=US
KR_MARKET_ENABLED=true

# Data sources
NAVER_ENABLED=true
DART_ENABLED=true
KR_COMMUNITY_ENABLED=true
KR_NEWS_ENABLED=true
KR_RESEARCH_ENABLED=true
KR_GLOBAL_CONTEXT_ENABLED=true

# Pipeline limits
GATHER_MAX_ITEMS_PER_SOURCE=200
SCORE_TOP_N=50
DECIDE_TOP_N=10
RUN_MAX_SECONDS=25
MIN_SECONDS_BETWEEN_RUNS=120

# LLM configuration
LLM_MAX_SIGNALS_PER_RUN=10
LLM_MAX_CALLS_PER_RUN=10
LLM_MAX_TOKENS_PER_CALL=1500
```

## Usage

### API Endpoints

#### Health Check
```bash
GET /api/health
```

#### Trigger Pipeline (Authenticated)
```bash
POST /api/agent/trigger
```

#### Symbol Search
```bash
GET /api/agent/symbols/search?q= symbol
```

#### Symbol Resolution
```bash
GET /api/agent/symbols/resolve?symbol= symbol
```

#### Symbol Report
```bash
GET /api/agent/symbol-report?symbol= symbol
```

### Dashboard

Access the web interface at `http://localhost:3000/dashboard` to:
- View collected signals
- See scored results
- Check AI decisions
- Review daily reports
- Configure settings

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run GUI quality checks
npm run test:gui

# Run GUI feature checks
npm run test:gui:features

# Run branding checks
npm run branding:check

# Run database migration
npm run db:migrate
```

### Development Scripts

```bash
# Start development server
npm run dev

# Start development server on port 3333
npm run dev:3333

# Start development server with Docker
npm run dev:up

# Stop development environment
npm run dev:down

# Check development status
npm run dev:status
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Standards

- Follow TypeScript best practices
- Maintain consistent code style
- Write comprehensive tests
- Update documentation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 DeepStock Research

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```