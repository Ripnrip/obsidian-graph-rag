import { App, PluginSettingTab, Setting } from "obsidian";
import type GraphRAGPlugin from "./main";

export interface GraphRAGSettings {
  openaiApiKey: string;
  embeddingModel: string;
  chatModel: string;
  topK: number;
  graphHops: number;
  maxContextLength: number;
  autoIndex: boolean;
  systemPrompt: string;
}

export const DEFAULT_SETTINGS: GraphRAGSettings = {
  openaiApiKey: "",
  embeddingModel: "text-embedding-3-small",
  chatModel: "gpt-4.1-mini",
  topK: 5,
  graphHops: 2,
  maxContextLength: 12000,
  autoIndex: true,
  systemPrompt:
    "You are a knowledgeable assistant that answers questions based on the user's personal notes. Use the provided context from their knowledge base to give accurate, helpful answers. Always reference which notes your information comes from.",
};

export class GraphRAGSettingTab extends PluginSettingTab {
  plugin: GraphRAGPlugin;

  constructor(app: App, plugin: GraphRAGPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Graph RAG Settings" });
    containerEl.createEl("p", {
      text: "Configure your Graph RAG plugin for interactive knowledge graph visualization and AI-powered retrieval.",
      cls: "setting-item-description",
    });

    // API Configuration
    containerEl.createEl("h3", { text: "🔑 API Configuration" });

    new Setting(containerEl)
      .setName("OpenAI API Key")
      .setDesc("Your OpenAI API key for embeddings and chat completions.")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Embedding Model")
      .setDesc("Model used for generating note embeddings.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("text-embedding-3-small", "text-embedding-3-small (fast, cheap)")
          .addOption("text-embedding-3-large", "text-embedding-3-large (higher quality)")
          .setValue(this.plugin.settings.embeddingModel)
          .onChange(async (value) => {
            this.plugin.settings.embeddingModel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Chat Model")
      .setDesc("Model used for answering questions.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("gpt-4.1-mini", "GPT-4.1 Mini (fast)")
          .addOption("gpt-4.1-nano", "GPT-4.1 Nano (fastest)")
          .addOption("gpt-4o", "GPT-4o (powerful)")
          .addOption("gpt-4o-mini", "GPT-4o Mini (balanced)")
          .setValue(this.plugin.settings.chatModel)
          .onChange(async (value) => {
            this.plugin.settings.chatModel = value;
            await this.plugin.saveSettings();
          })
      );

    // RAG Configuration
    containerEl.createEl("h3", { text: "🧠 RAG Configuration" });

    new Setting(containerEl)
      .setName("Top K Results")
      .setDesc("Number of most similar notes to retrieve via vector search.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.plugin.settings.topK)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.topK = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Graph Hops")
      .setDesc("How many link hops to traverse from vector search results for additional context.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 5, 1)
          .setValue(this.plugin.settings.graphHops)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.graphHops = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max Context Length")
      .setDesc("Maximum character length of context sent to the LLM.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.maxContextLength))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.maxContextLength = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Auto-Index on Startup")
      .setDesc("Automatically build/update the embedding index when the plugin loads.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoIndex)
          .onChange(async (value) => {
            this.plugin.settings.autoIndex = value;
            await this.plugin.saveSettings();
          })
      );

    // System Prompt
    containerEl.createEl("h3", { text: "📝 System Prompt" });

    new Setting(containerEl)
      .setName("System Prompt")
      .setDesc("The system instruction sent to the LLM for answering questions.")
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.systemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.systemPrompt = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
