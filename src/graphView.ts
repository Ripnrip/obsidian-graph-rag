import { ItemView, WorkspaceLeaf } from "obsidian";
import { VaultGraph } from "./vaultParser";

export const GRAPH_RAG_VIEW_TYPE = "graph-rag-view";

// Color palette
const COLORS = {
  defaultNode: [0.45, 0.55, 0.85, 1.0], // Soft blue
  highlightVector: [0.95, 0.3, 0.5, 1.0], // Pink/red for vector hits
  highlightGraph: [0.95, 0.7, 0.2, 1.0], // Gold for graph traversal hits
  defaultLink: [0.3, 0.3, 0.4, 0.3], // Subtle gray
  highlightLink: [0.95, 0.5, 0.3, 0.8], // Orange for highlighted links
  background: "#0d1117",
};

export class GraphRAGView extends ItemView {
  private graphContainer: HTMLDivElement;
  private chatContainer: HTMLDivElement;
  private graphInstance: any = null;
  private vaultGraph: VaultGraph | null = null;
  private onQueryCallback: ((query: string) => Promise<void>) | null = null;
  private onNodeClickCallback: ((nodeIndex: number) => void) | null = null;
  private statusEl: HTMLDivElement;
  private chatMessages: HTMLDivElement;
  private chatInput: HTMLTextAreaElement;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return GRAPH_RAG_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Graph RAG";
  }

  getIcon(): string {
    return "git-fork";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("graph-rag-container");

    // Main layout: graph on left, chat on right
    const wrapper = container.createDiv({ cls: "graph-rag-wrapper" });

    // Graph panel
    const graphPanel = wrapper.createDiv({ cls: "graph-rag-graph-panel" });
    const graphHeader = graphPanel.createDiv({ cls: "graph-rag-panel-header" });
    graphHeader.createEl("h3", { text: "🌐 Knowledge Graph" });
    this.statusEl = graphHeader.createDiv({ cls: "graph-rag-status" });
    this.statusEl.setText("Initializing...");

    this.graphContainer = graphPanel.createDiv({ cls: "graph-rag-canvas" });

    // Graph controls
    const controls = graphPanel.createDiv({ cls: "graph-rag-controls" });
    const fitBtn = controls.createEl("button", { text: "Fit View", cls: "graph-rag-btn" });
    fitBtn.addEventListener("click", () => {
      if (this.graphInstance) {
        this.graphInstance.fitView();
      }
    });
    const resetBtn = controls.createEl("button", { text: "Reset Highlights", cls: "graph-rag-btn" });
    resetBtn.addEventListener("click", () => {
      this.clearHighlights();
    });

    // Chat panel
    const chatPanel = wrapper.createDiv({ cls: "graph-rag-chat-panel" });
    const chatHeader = chatPanel.createDiv({ cls: "graph-rag-panel-header" });
    chatHeader.createEl("h3", { text: "💬 Graph RAG Chat" });

    this.chatMessages = chatPanel.createDiv({ cls: "graph-rag-messages" });

    // Welcome message
    this.addChatMessage(
      "assistant",
      "Welcome to Graph RAG! Ask me anything about your vault. I'll use both semantic search and your knowledge graph to find the best answers."
    );

    const inputRow = chatPanel.createDiv({ cls: "graph-rag-input-row" });
    this.chatInput = inputRow.createEl("textarea", {
      cls: "graph-rag-input",
      attr: { placeholder: "Ask about your notes...", rows: "2" },
    });
    const sendBtn = inputRow.createEl("button", {
      text: "Send",
      cls: "graph-rag-send-btn",
    });

    sendBtn.addEventListener("click", () => this.handleSend());
    this.chatInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  async onClose(): Promise<void> {
    if (this.graphInstance) {
      this.graphInstance.destroy();
      this.graphInstance = null;
    }
  }

  setQueryCallback(cb: (query: string) => Promise<void>): void {
    this.onQueryCallback = cb;
  }

  setNodeClickCallback(cb: (nodeIndex: number) => void): void {
    this.onNodeClickCallback = cb;
  }

  setStatus(text: string): void {
    if (this.statusEl) {
      this.statusEl.setText(text);
    }
  }

  /**
   * Render the vault graph using cosmos.gl
   */
  async renderGraph(graph: VaultGraph): Promise<void> {
    this.vaultGraph = graph;

    if (this.graphInstance) {
      this.graphInstance.destroy();
      this.graphInstance = null;
    }

    if (graph.nodes.length === 0) {
      this.setStatus("No notes found in vault.");
      return;
    }

    try {
      // Dynamic import of cosmos.gl
      const { Graph } = await import("@cosmos.gl/graph");

      const numNodes = graph.nodes.length;

      // Generate initial positions using a simple layout
      const pointPositions = new Float32Array(numNodes * 2);
      for (let i = 0; i < numNodes; i++) {
        // Spread nodes in a circle initially
        const angle = (i / numNodes) * Math.PI * 2;
        const radius = Math.sqrt(numNodes) * 20;
        pointPositions[i * 2] = Math.cos(angle) * radius + (Math.random() - 0.5) * radius * 0.5;
        pointPositions[i * 2 + 1] = Math.sin(angle) * radius + (Math.random() - 0.5) * radius * 0.5;
      }

      // Build links array
      const linkPairs: number[] = [];
      for (const [src, neighbors] of graph.adjacency) {
        for (const tgt of neighbors) {
          if (src < tgt) {
            // Avoid duplicates for undirected graph
            linkPairs.push(src, tgt);
          }
        }
      }
      const links = new Float32Array(linkPairs);

      // Node sizes based on connectivity
      const pointSizes = new Float32Array(numNodes);
      for (let i = 0; i < numNodes; i++) {
        const connections = graph.adjacency.get(i)?.size || 0;
        pointSizes[i] = Math.max(3, Math.min(15, 3 + connections * 1.5));
      }

      // Default colors
      const pointColors = new Float32Array(numNodes * 4);
      for (let i = 0; i < numNodes; i++) {
        pointColors[i * 4] = COLORS.defaultNode[0];
        pointColors[i * 4 + 1] = COLORS.defaultNode[1];
        pointColors[i * 4 + 2] = COLORS.defaultNode[2];
        pointColors[i * 4 + 3] = COLORS.defaultNode[3];
      }

      const config = {
        spaceSize: 8192,
        backgroundColor: COLORS.background,
        simulationFriction: 0.85,
        simulationGravity: 0.25,
        simulationRepulsion: 1.0,
        simulationLinkSpring: 1.0,
        simulationLinkDistance: 10,
        curvedLinks: true,
        fitViewOnInit: true,
        fitViewDelay: 1500,
        fitViewPadding: 0.2,
        enableDrag: true,
        showLabelsFor: [] as number[],
        renderLinks: true,
        linkWidth: 0.5,
        linkColor: COLORS.defaultLink,
        pointSizeScale: 1,
        onClick: (pointIndex: number | undefined) => {
          if (pointIndex !== undefined && this.vaultGraph) {
            const node = this.vaultGraph.nodes[pointIndex];
            if (node && this.onNodeClickCallback) {
              this.onNodeClickCallback(pointIndex);
            }
          }
        },
        onMouseMove: (pointIndex: number | undefined) => {
          if (pointIndex !== undefined && this.vaultGraph) {
            const node = this.vaultGraph.nodes[pointIndex];
            if (node) {
              this.graphContainer.title = node.name;
            }
          } else {
            this.graphContainer.title = "";
          }
        },
      };

      this.graphInstance = new Graph(this.graphContainer, config);
      this.graphInstance.setPointPositions(pointPositions);
      this.graphInstance.setLinks(links);
      this.graphInstance.setPointSizes(pointSizes);
      this.graphInstance.setPointColors(pointColors);
      this.graphInstance.render();

      this.setStatus(`${numNodes} notes · ${linkPairs.length / 2} connections`);
    } catch (e) {
      console.error("Failed to render graph:", e);
      this.setStatus("Failed to render graph. See console for details.");

      // Fallback: render a simple canvas-based graph
      this.renderFallbackGraph(graph);
    }
  }

  /**
   * Fallback canvas-based graph rendering if cosmos.gl fails.
   */
  private renderFallbackGraph(graph: VaultGraph): void {
    const canvas = this.graphContainer.createEl("canvas", { cls: "graph-rag-fallback-canvas" });
    const rect = this.graphContainer.getBoundingClientRect();
    canvas.width = rect.width || 600;
    canvas.height = rect.height || 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const numNodes = graph.nodes.length;
    const positions: { x: number; y: number }[] = [];

    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * Math.PI * 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.35;
      positions.push({
        x: canvas.width / 2 + Math.cos(angle) * radius,
        y: canvas.height / 2 + Math.sin(angle) * radius,
      });
    }

    // Draw links
    ctx.strokeStyle = "rgba(100, 120, 160, 0.2)";
    ctx.lineWidth = 0.5;
    for (const [src, neighbors] of graph.adjacency) {
      for (const tgt of neighbors) {
        if (src < tgt) {
          ctx.beginPath();
          ctx.moveTo(positions[src].x, positions[src].y);
          ctx.lineTo(positions[tgt].x, positions[tgt].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (let i = 0; i < numNodes; i++) {
      const connections = graph.adjacency.get(i)?.size || 0;
      const size = Math.max(2, Math.min(8, 2 + connections));
      ctx.fillStyle = `rgba(115, 140, 217, 0.8)`;
      ctx.beginPath();
      ctx.arc(positions[i].x, positions[i].y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    this.setStatus(`${numNodes} notes (fallback renderer)`);
  }

  /**
   * Highlight specific nodes in the graph.
   */
  highlightNodes(vectorHits: number[], graphHits: number[]): void {
    if (!this.graphInstance || !this.vaultGraph) return;

    const numNodes = this.vaultGraph.nodes.length;
    const pointColors = new Float32Array(numNodes * 4);
    const pointSizes = new Float32Array(numNodes);

    // Set default colors and sizes
    for (let i = 0; i < numNodes; i++) {
      const connections = this.vaultGraph.adjacency.get(i)?.size || 0;
      pointColors[i * 4] = COLORS.defaultNode[0];
      pointColors[i * 4 + 1] = COLORS.defaultNode[1];
      pointColors[i * 4 + 2] = COLORS.defaultNode[2];
      pointColors[i * 4 + 3] = 0.3; // Dim non-relevant nodes
      pointSizes[i] = Math.max(3, Math.min(15, 3 + connections * 1.5));
    }

    // Highlight graph traversal hits (gold)
    for (const idx of graphHits) {
      pointColors[idx * 4] = COLORS.highlightGraph[0];
      pointColors[idx * 4 + 1] = COLORS.highlightGraph[1];
      pointColors[idx * 4 + 2] = COLORS.highlightGraph[2];
      pointColors[idx * 4 + 3] = COLORS.highlightGraph[3];
      pointSizes[idx] = Math.max(pointSizes[idx], 10);
    }

    // Highlight vector hits (pink - highest priority)
    for (const idx of vectorHits) {
      pointColors[idx * 4] = COLORS.highlightVector[0];
      pointColors[idx * 4 + 1] = COLORS.highlightVector[1];
      pointColors[idx * 4 + 2] = COLORS.highlightVector[2];
      pointColors[idx * 4 + 3] = COLORS.highlightVector[3];
      pointSizes[idx] = Math.max(pointSizes[idx], 14);
    }

    this.graphInstance.setPointColors(pointColors);
    this.graphInstance.setPointSizes(pointSizes);
    this.graphInstance.render();
  }

  /**
   * Clear all highlights and restore default colors.
   */
  clearHighlights(): void {
    if (!this.graphInstance || !this.vaultGraph) return;

    const numNodes = this.vaultGraph.nodes.length;
    const pointColors = new Float32Array(numNodes * 4);
    const pointSizes = new Float32Array(numNodes);

    for (let i = 0; i < numNodes; i++) {
      const connections = this.vaultGraph.adjacency.get(i)?.size || 0;
      pointColors[i * 4] = COLORS.defaultNode[0];
      pointColors[i * 4 + 1] = COLORS.defaultNode[1];
      pointColors[i * 4 + 2] = COLORS.defaultNode[2];
      pointColors[i * 4 + 3] = COLORS.defaultNode[3];
      pointSizes[i] = Math.max(3, Math.min(15, 3 + connections * 1.5));
    }

    this.graphInstance.setPointColors(pointColors);
    this.graphInstance.setPointSizes(pointSizes);
    this.graphInstance.render();
  }

  /**
   * Add a message to the chat panel.
   */
  addChatMessage(role: "user" | "assistant" | "system", content: string): void {
    const msgEl = this.chatMessages.createDiv({
      cls: `graph-rag-message graph-rag-message-${role}`,
    });

    if (role === "user") {
      msgEl.createDiv({ cls: "graph-rag-message-label", text: "You" });
    } else if (role === "assistant") {
      msgEl.createDiv({ cls: "graph-rag-message-label", text: "Graph RAG" });
    } else {
      msgEl.createDiv({ cls: "graph-rag-message-label", text: "System" });
    }

    const contentEl = msgEl.createDiv({ cls: "graph-rag-message-content" });
    // Simple markdown-like rendering
    contentEl.innerHTML = this.simpleMarkdown(content);

    // Scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  /**
   * Show a loading indicator in chat.
   */
  showLoading(): HTMLDivElement {
    const loadingEl = this.chatMessages.createDiv({
      cls: "graph-rag-message graph-rag-message-assistant graph-rag-loading",
    });
    loadingEl.createDiv({ cls: "graph-rag-message-label", text: "Graph RAG" });
    const dots = loadingEl.createDiv({ cls: "graph-rag-message-content" });
    dots.setText("Searching your knowledge graph...");
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    return loadingEl;
  }

  private async handleSend(): Promise<void> {
    const query = this.chatInput.value.trim();
    if (!query) return;

    this.chatInput.value = "";
    this.addChatMessage("user", query);

    if (this.onQueryCallback) {
      await this.onQueryCallback(query);
    }
  }

  private simpleMarkdown(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }
}
