import { App, TFile, CachedMetadata } from "obsidian";

export interface VaultNode {
  id: number;
  path: string;
  name: string;
  content: string;
  tags: string[];
  links: string[]; // paths of linked notes
  backlinks: string[]; // paths of notes linking to this one
}

export interface VaultGraph {
  nodes: VaultNode[];
  nodeMap: Map<string, number>; // path -> node index
  adjacency: Map<number, Set<number>>; // node index -> set of connected node indices
}

/**
 * Parse the entire vault into a graph structure.
 */
export async function parseVault(app: App): Promise<VaultGraph> {
  const files = app.vault.getMarkdownFiles();
  const nodes: VaultNode[] = [];
  const nodeMap = new Map<string, number>();
  const adjacency = new Map<number, Set<number>>();

  // First pass: create nodes
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const content = await app.vault.cachedRead(file);
    const cache: CachedMetadata | null = app.metadataCache.getFileCache(file);

    const tags: string[] = [];
    if (cache?.tags) {
      for (const t of cache.tags) {
        tags.push(t.tag);
      }
    }
    if (cache?.frontmatter?.tags) {
      const fmTags = cache.frontmatter.tags;
      if (Array.isArray(fmTags)) {
        for (const t of fmTags) {
          tags.push(typeof t === "string" ? (t.startsWith("#") ? t : "#" + t) : String(t));
        }
      }
    }

    const links: string[] = [];
    if (cache?.links) {
      for (const link of cache.links) {
        const resolved = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (resolved) {
          links.push(resolved.path);
        }
      }
    }
    if (cache?.embeds) {
      for (const embed of cache.embeds) {
        const resolved = app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
        if (resolved && resolved.extension === "md") {
          links.push(resolved.path);
        }
      }
    }

    nodes.push({
      id: i,
      path: file.path,
      name: file.basename,
      content: content,
      tags: [...new Set(tags)],
      links: [...new Set(links)],
      backlinks: [],
    });
    nodeMap.set(file.path, i);
  }

  // Second pass: build adjacency and backlinks
  for (const node of nodes) {
    const neighbors = new Set<number>();
    for (const linkPath of node.links) {
      const targetIdx = nodeMap.get(linkPath);
      if (targetIdx !== undefined) {
        neighbors.add(targetIdx);
        nodes[targetIdx].backlinks.push(node.path);
      }
    }
    adjacency.set(node.id, neighbors);
  }

  // Add backlink edges to adjacency (undirected graph)
  for (const node of nodes) {
    const neighbors = adjacency.get(node.id) || new Set<number>();
    for (const blPath of node.backlinks) {
      const srcIdx = nodeMap.get(blPath);
      if (srcIdx !== undefined) {
        neighbors.add(srcIdx);
      }
    }
    adjacency.set(node.id, neighbors);
  }

  return { nodes, nodeMap, adjacency };
}

/**
 * BFS traversal from a set of seed nodes, up to maxHops.
 * Returns all discovered node indices.
 */
export function graphTraversal(
  adjacency: Map<number, Set<number>>,
  seeds: number[],
  maxHops: number = 2
): Set<number> {
  const visited = new Set<number>();
  let frontier = new Set<number>(seeds);

  for (const s of seeds) {
    visited.add(s);
  }

  for (let hop = 0; hop < maxHops; hop++) {
    const nextFrontier = new Set<number>();
    for (const nodeIdx of frontier) {
      const neighbors = adjacency.get(nodeIdx);
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            nextFrontier.add(n);
          }
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  return visited;
}
