# DeepStock Research Engine

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT">
</div>

<div align="center">
  <h3>A research-only stock analysis engine that automatically collects, scores, and generates trading signals without broker execution</h3>
  <p>Provides timing insights with research-quality analysis for US and Korean markets</p>
</div>

---

## 🚀 Features

- **Multi-Source Signal Collection**: Gather signals from Reddit, StockTwits, SEC, News, Crypto, and Korean market sources
- **AI-Powered Decision Making**: Generate buy/hold/sell decisions with confidence levels and strategy recommendations
- **Comprehensive Daily Reports**: Create detailed daily summaries with themes, risks, and market insights
- **Modular Pipeline Architecture**: Independent stages with timeboxing and safety guards
- **Research-Only Design**: No broker execution - designed exclusively for analysis
- **Multi-Market Support**: Simultaneous support for US and Korean markets
- **Real-time Data Processing**: Fast pipeline execution with efficient data handling

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DeepStock Research                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────┐ │
│  │  Frontend   │  │   API       │  │  Pipeline   │  │ DB  │ │
│  │ (Next.js)   │  │ (Next.js)   │  │ (Core)      │  │     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Pipeline Stages

1. **Gather**: Collect signals from various sources
2. **Normalize**: Standardize and enrich signal data
3. **Score**: Evaluate signal importance and relevance
4. **Decide**: Generate AI-powered trading decisions
5. **Report**: Create daily summary reports

## 📥 Installation

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

## ⚙️ Configuration

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

## 🚀 Usage

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Check system health status |
| `/api/agent/trigger` | POST | Trigger pipeline execution (authenticated) |
| `/api/agent/symbols/search` | GET | Search for symbols |
| `/api/agent/symbols/resolve` | GET | Resolve symbol information |
| `/api/agent/symbol-report` | GET | Get symbol analysis report |

### Dashboard

Access the web interface at `http://localhost:3000/dashboard` to:

- View collected signals and their sources
- See scored results with confidence levels
- Check AI-generated trading decisions
- Review comprehensive daily reports
- Configure system settings and preferences

## 🛠️ Development

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

## 🤝 Contributing

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
- Ensure all tests pass before submitting

## 📄 License

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