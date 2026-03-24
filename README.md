# Graph RAG — Obsidian Plugin

An interactive, GPU-accelerated knowledge graph visualization with **Graph RAG** (Retrieval-Augmented Generation) for [Obsidian](https://obsidian.md). Powered by [cosmos.gl](https://github.com/Ripnrip/graph).

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## What is Graph RAG?

Graph RAG combines **vector similarity search** with **knowledge graph traversal** to provide richer, more contextual answers from your vault. Instead of just finding notes that are semantically similar to your question, it also explores the connections between those notes — following links, backlinks, and tags — to discover related context that traditional RAG would miss.

## Features

### Interactive Knowledge Graph
- **GPU-accelerated** force-directed graph rendering via cosmos.gl
- Real-time simulation of your entire vault as a network
- Node sizes reflect connectivity (more links = larger node)
- Click any node to open the corresponding note
- Drag, zoom, and pan to explore your knowledge

### Graph-Enhanced RAG Chat
- Ask natural language questions about your vault
- **Hybrid retrieval**: combines vector search + graph traversal
- Visual feedback: relevant nodes light up in the graph during queries
  - **Pink nodes** = direct semantic matches (vector search)
  - **Gold nodes** = connected notes discovered via graph traversal
- Source attribution in every response

### Smart Indexing
- Incremental embedding generation (only re-embeds changed notes)
- Configurable embedding models (text-embedding-3-small/large)
- Persistent storage — embeddings survive restarts
- Auto-index on startup (configurable)

## Installation

### Manual Installation

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`)
2. Create a folder in your vault: `.obsidian/plugins/graph-rag/`
3. Copy the three files into that folder
4. Restart Obsidian
5. Enable "Graph RAG" in Settings → Community Plugins

### From Source

```bash
git clone https://github.com/Ripnrip/obsidian-graph-rag.git
cd obsidian-graph-rag
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/graph-rag/` directory.

## Setup

1. **Set your OpenAI API key** in Settings → Graph RAG → API Configuration
2. **Open Graph RAG** via the ribbon icon (fork icon) or Command Palette → "Open Graph RAG view"
3. **Index your vault** via Command Palette → "Re-index vault embeddings" (or it auto-indexes on first query)
4. **Start asking questions** in the chat panel!

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| OpenAI API Key | — | Required for embeddings and chat |
| Embedding Model | text-embedding-3-small | Model for note embeddings |
| Chat Model | gpt-4.1-mini | Model for answering questions |
| Top K Results | 5 | Number of vector search results |
| Graph Hops | 2 | Link traversal depth from search results |
| Max Context Length | 12000 | Max characters sent to LLM |
| Auto-Index on Startup | true | Auto-update embeddings on load |

## How It Works

```
Your Question
     │
     ▼
┌─────────────┐
│  Embed Query │ ← OpenAI Embeddings API
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│Vector Search │────▶│ Top-K Notes  │
└──────┬──────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
┌─────────────┐     ┌──────────────┐
│Graph Traverse│────▶│ Related Notes│
│  (BFS/DFS)  │     │ (N-hop away) │
└──────┬──────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
┌─────────────────────────────────┐
│     Combined Context Assembly    │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│         LLM Generation          │ ← OpenAI Chat API
└───────────────┬─────────────────┘
                │
                ▼
         Answer + Sources
```

## Commands

| Command | Description |
|---------|-------------|
| Open Graph RAG view | Opens the graph + chat panel |
| Re-index vault embeddings | Rebuilds the embedding index |
| Refresh knowledge graph | Re-parses vault and redraws graph |

## Tech Stack

- **cosmos.gl** (`@cosmos.gl/graph`) — GPU-accelerated WebGL graph rendering
- **OpenAI API** — Embeddings (text-embedding-3-small) + Chat (gpt-4.1-mini)
- **TypeScript** — Type-safe plugin development
- **esbuild** — Fast bundling

## License

MIT

## Credits

- [cosmos.gl](https://github.com/cosmosgl/graph) — GPU-accelerated force graph engine
- [Obsidian](https://obsidian.md) — The knowledge base platform
- Built with the [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) template
