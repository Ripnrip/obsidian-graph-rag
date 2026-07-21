<div align="center">

# Graph RAG for Obsidian

### GPU-accelerated knowledge graph visualization with Graph RAG

<img src="docs/images/obsidian-graph-rag-ghibli.png" width="800" alt="Graph RAG for Obsidian Banner" style="border-radius: 16px;">

<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Portfolio](https://img.shields.io/badge/Portfolio-GuriboyCodes-FFB6C1?style=for-the-badge)](https://guriboycodes.com)


</div>

---

## 🚀 Overview

An interactive, GPU-accelerated knowledge graph visualization with **Graph RAG** (Retrieval-Augmented Generation) for Obsidian. Powered by `cosmos.gl`.

## 🧠 How Graph RAG Works

<div align="center">
  <img src="docs/images/obsidian-rag.png" width="600" alt="Graph RAG Architecture">
</div>

Graph RAG combines **vector similarity search** with **knowledge graph traversal** to provide richer, more contextual answers from your vault. Instead of just finding notes that are semantically similar to your question, it also explores the connections between those notes to synthesize comprehensive answers.

## ✨ Features

- **GPU Rendering**: Handles massive vaults smoothly via `cosmos.gl`
- **Local Indexing**: SQLite-backed vector embeddings
- **Contextual Chat**: Ask your vault questions and get cited, graph-aware answers
