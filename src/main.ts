import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { GraphRAGView, GRAPH_RAG_VIEW_TYPE } from "./graphView";
import { GraphRAGSettingTab, GraphRAGSettings, DEFAULT_SETTINGS } from "./settings";
import { parseVault, VaultGraph } from "./vaultParser";
import { EmbeddingStore, buildEmbeddingStore } from "./embeddings";
import { queryGraphRAG, RAGResult } from "./ragEngine";

export default class GraphRAGPlugin extends Plugin {
  settings: GraphRAGSettings = DEFAULT_SETTINGS;
  private vaultGraph: VaultGraph | null = null;
  private embeddingStore: EmbeddingStore = {};
  private graphView: GraphRAGView | null = null;
  private isIndexing = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register the custom view
    this.registerView(GRAPH_RAG_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
      this.graphView = new GraphRAGView(leaf);
      this.graphView.setQueryCallback(async (query: string) => {
        await this.handleQuery(query);
      });
      this.graphView.setNodeClickCallback((nodeIndex: number) => {
        this.handleNodeClick(nodeIndex);
      });
      return this.graphView;
    });

    // Add ribbon icon
    this.addRibbonIcon("git-fork", "Open Graph RAG", async () => {
      await this.activateView();
    });

    // Add commands
    this.addCommand({
      id: "open-graph-rag",
      name: "Open Graph RAG view",
      callback: async () => {
        await this.activateView();
      },
    });

    this.addCommand({
      id: "reindex-vault",
      name: "Re-index vault embeddings",
      callback: async () => {
        await this.indexVault();
      },
    });

    this.addCommand({
      id: "refresh-graph",
      name: "Refresh knowledge graph",
      callback: async () => {
        await this.refreshGraph();
      },
    });

    // Settings tab
    this.addSettingTab(new GraphRAGSettingTab(this.app, this));

    // Load saved embeddings
    await this.loadEmbeddingStore();

    // Auto-index on startup if enabled
    if (this.settings.autoIndex && this.settings.openaiApiKey) {
      // Wait for vault to be ready
      this.app.workspace.onLayoutReady(async () => {
        await this.refreshGraph();
      });
    }
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(GRAPH_RAG_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Activate the Graph RAG view.
   */
  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(GRAPH_RAG_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: GRAPH_RAG_VIEW_TYPE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }

    // Parse vault and render graph
    await this.refreshGraph();
  }

  /**
   * Parse the vault and render the graph.
   */
  async refreshGraph(): Promise<void> {
    if (this.graphView) {
      this.graphView.setStatus("Parsing vault...");
    }

    try {
      this.vaultGraph = await parseVault(this.app);

      if (this.graphView) {
        await this.graphView.renderGraph(this.vaultGraph);
      }

      new Notice(`Graph RAG: Parsed ${this.vaultGraph.nodes.length} notes`);
    } catch (e) {
      console.error("Failed to parse vault:", e);
      new Notice("Graph RAG: Failed to parse vault. See console.");
    }
  }

  /**
   * Index the vault by generating embeddings.
   */
  async indexVault(): Promise<void> {
    if (this.isIndexing) {
      new Notice("Graph RAG: Indexing already in progress...");
      return;
    }

    if (!this.settings.openaiApiKey) {
      new Notice("Graph RAG: Please set your OpenAI API key in settings.");
      return;
    }

    this.isIndexing = true;

    if (!this.vaultGraph) {
      this.vaultGraph = await parseVault(this.app);
    }

    try {
      if (this.graphView) {
        this.graphView.setStatus("Indexing embeddings...");
      }

      new Notice("Graph RAG: Starting embedding index...");

      this.embeddingStore = await buildEmbeddingStore(
        this.vaultGraph.nodes,
        this.embeddingStore,
        this.settings.openaiApiKey,
        this.settings.embeddingModel,
        (current, total) => {
          if (this.graphView) {
            this.graphView.setStatus(`Indexing: ${current}/${total} notes`);
          }
        }
      );

      await this.saveEmbeddingStore();

      const count = Object.keys(this.embeddingStore).length;
      new Notice(`Graph RAG: Indexed ${count} notes`);

      if (this.graphView) {
        this.graphView.setStatus(
          `${this.vaultGraph.nodes.length} notes · ${count} indexed`
        );
      }
    } catch (e) {
      console.error("Indexing failed:", e);
      new Notice("Graph RAG: Indexing failed. Check your API key and console.");
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Handle a RAG query from the chat panel.
   */
  async handleQuery(query: string): Promise<void> {
    if (!this.settings.openaiApiKey) {
      if (this.graphView) {
        this.graphView.addChatMessage(
          "system",
          "Please set your OpenAI API key in the Graph RAG settings (Settings → Graph RAG)."
        );
      }
      return;
    }

    if (!this.vaultGraph) {
      this.vaultGraph = await parseVault(this.app);
    }

    // Check if embeddings exist, if not, index first
    if (Object.keys(this.embeddingStore).length === 0) {
      if (this.graphView) {
        this.graphView.addChatMessage(
          "system",
          "No embeddings found. Indexing your vault first... This may take a moment."
        );
      }
      await this.indexVault();
    }

    if (Object.keys(this.embeddingStore).length === 0) {
      if (this.graphView) {
        this.graphView.addChatMessage(
          "system",
          "Failed to create embeddings. Please check your API key in settings."
        );
      }
      return;
    }

    // Show loading
    let loadingEl: HTMLDivElement | null = null;
    if (this.graphView) {
      loadingEl = this.graphView.showLoading();
    }

    try {
      const result: RAGResult = await queryGraphRAG(
        query,
        this.vaultGraph,
        this.embeddingStore,
        this.settings.openaiApiKey,
        {
          embeddingModel: this.settings.embeddingModel,
          chatModel: this.settings.chatModel,
          topK: this.settings.topK,
          graphHops: this.settings.graphHops,
          maxContextLength: this.settings.maxContextLength,
          systemPrompt: this.settings.systemPrompt,
        }
      );

      // Remove loading indicator
      if (loadingEl) {
        loadingEl.remove();
      }

      // Add the answer to chat
      if (this.graphView) {
        // Build source info
        let sources = "";
        if (result.vectorHits.length > 0) {
          const vectorNames = result.vectorHits
            .map((idx) => this.vaultGraph?.nodes[idx]?.name)
            .filter(Boolean);
          sources += `\n\n**Direct matches:** ${vectorNames.join(", ")}`;
        }
        if (result.graphHits.length > 0) {
          const graphNames = result.graphHits
            .slice(0, 5)
            .map((idx) => this.vaultGraph?.nodes[idx]?.name)
            .filter(Boolean);
          sources += `\n**Connected notes:** ${graphNames.join(", ")}${result.graphHits.length > 5 ? ` (+${result.graphHits.length - 5} more)` : ""}`;
        }

        this.graphView.addChatMessage("assistant", result.answer + sources);

        // Highlight nodes in the graph
        this.graphView.highlightNodes(result.vectorHits, result.graphHits);
      }
    } catch (e) {
      console.error("Query failed:", e);
      if (loadingEl) {
        loadingEl.remove();
      }
      if (this.graphView) {
        this.graphView.addChatMessage(
          "system",
          `Query failed: ${e instanceof Error ? e.message : "Unknown error"}. Please check your API key and try again.`
        );
      }
    }
  }

  /**
   * Handle clicking a node in the graph.
   */
  handleNodeClick(nodeIndex: number): void {
    if (!this.vaultGraph) return;
    const node = this.vaultGraph.nodes[nodeIndex];
    if (!node) return;

    // Open the note in a new leaf
    const file = this.app.vault.getAbstractFileByPath(node.path);
    if (file) {
      const leaf = this.app.workspace.getLeaf(false);
      leaf.openFile(file as any);
    }
  }

  /**
   * Save embedding store to plugin data.
   */
  private async saveEmbeddingStore(): Promise<void> {
    try {
      const dataPath = `${this.manifest.dir}/embeddings.json`;
      await this.app.vault.adapter.write(
        dataPath,
        JSON.stringify(this.embeddingStore)
      );
    } catch (e) {
      console.error("Failed to save embeddings:", e);
    }
  }

  /**
   * Load embedding store from plugin data.
   */
  private async loadEmbeddingStore(): Promise<void> {
    try {
      const dataPath = `${this.manifest.dir}/embeddings.json`;
      const exists = await this.app.vault.adapter.exists(dataPath);
      if (exists) {
        const data = await this.app.vault.adapter.read(dataPath);
        this.embeddingStore = JSON.parse(data);
      }
    } catch (e) {
      console.error("Failed to load embeddings:", e);
      this.embeddingStore = {};
    }
  }
}
