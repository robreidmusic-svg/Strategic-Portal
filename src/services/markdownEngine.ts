// ═══════════════════════════════════════════════════════════════
// BROGGO 2.0 — MARKDOWN NORMALISATION & MIRROR
// Level B: Deterministic markdown formatting
// Level C: File-based .md mirror
// ═══════════════════════════════════════════════════════════════

import type { KnowledgeNode } from './researchService';

/**
 * Level B: Deterministic Markdown Normalisation
 * 
 * Takes the raw 'body' string from AI output and ensures it is
 * properly formatted Markdown. Adds headers, fixes tables,
 * and structures flat text into scannable sections.
 */
export function normaliseToMarkdown(node: {
  title: string;
  type: string;
  category: string;
  tags: string[];
  summary: string;
  body: string;
  source: string;
  sourceType: string;
  confidence?: string;
}): string {
  let md = node.body || '';

  // ── STEP 1: Ensure the body starts with a proper H1 header ──
  const hasH1 = /^#\s+.+/m.test(md);
  if (!hasH1) {
    md = `# ${node.title}\n\n${md}`;
  }

  // ── STEP 2: Add metadata block if not present ──
  const hasMetaBlock = md.includes('**Type:**') || md.includes('**Category:**');
  if (!hasMetaBlock) {
    const metaBlock = [
      '',
      `**Type:** ${node.type} | **Category:** ${node.category}`,
      node.tags.length > 0 ? `**Tags:** ${node.tags.join(', ')}` : '',
      node.confidence ? `**Confidence:** ${node.confidence}` : '',
      node.source && node.source !== 'manual' ? `**Source:** ${node.source}` : '',
      '',
      '---',
      '',
    ].filter(Boolean).join('\n');

    // Insert after the H1
    const h1Match = md.match(/^(#\s+.+\n)/);
    if (h1Match) {
      md = md.replace(h1Match[0], h1Match[0] + metaBlock);
    } else {
      md = metaBlock + md;
    }
  }

  // ── STEP 3: Add summary section if body doesn't already contain it ──
  if (node.summary && !md.includes(node.summary)) {
    const summaryBlock = `\n> ${node.summary}\n\n`;
    // Insert after metadata
    const dashIndex = md.indexOf('---');
    if (dashIndex > -1) {
      const afterDash = dashIndex + 4;
      md = md.substring(0, afterDash) + summaryBlock + md.substring(afterDash);
    }
  }

  // ── STEP 4: Fix common Markdown issues ──

  // Fix tables that are missing the separator row
  md = fixMarkdownTables(md);

  // Ensure blank lines before headers
  md = md.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

  // Ensure blank lines before and after code blocks
  md = md.replace(/([^\n])\n```/g, '$1\n\n```');
  md = md.replace(/```\n([^\n])/g, '```\n\n$1');

  // Remove excessive blank lines (3+ → 2)
  md = md.replace(/\n{4,}/g, '\n\n\n');

  // Trim
  md = md.trim();

  // ── STEP 5: Add footer ──
  const hasFooter = md.includes('---\n*Broggo 2.0');
  if (!hasFooter) {
    const timestamp = new Date().toISOString().split('T')[0];
    md += `\n\n---\n*Broggo 2.0 Intelligence Engine • ${timestamp}*\n`;
  }

  return md;
}

/**
 * Fix Markdown tables that are missing the separator row.
 * e.g., converts:
 *   | Name | City |
 *   | Equinix | Frankfurt |
 * to:
 *   | Name | City |
 *   |------|------|
 *   | Equinix | Frankfurt |
 */
function fixMarkdownTables(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    result.push(line);

    // If current line looks like a table header and the next line
    // is also a table row (not a separator), insert a separator
    if (
      line.trim().startsWith('|') &&
      line.trim().endsWith('|') &&
      nextLine &&
      nextLine.trim().startsWith('|') &&
      nextLine.trim().endsWith('|') &&
      !nextLine.includes('---')
    ) {
      // Check if the line after is already a separator
      const colCount = (line.match(/\|/g) || []).length - 1;
      if (colCount > 0) {
        const separator = '|' + Array(colCount).fill('---').join('|') + '|';
        // Only add if the next line isn't already a separator
        if (!nextLine.includes('---')) {
          result.push(separator);
        }
      }
    }
  }

  return result.join('\n');
}

/**
 * Level C: Generate a complete .md file from a KnowledgeNode.
 * Returns the full markdown string ready to be written to disk.
 */
export function nodeToMarkdownFile(node: KnowledgeNode): string {
  // Use the normalised body as the base
  const normalisedBody = normaliseToMarkdown({
    title: node.title,
    type: node.type,
    category: node.category,
    tags: node.tags || [],
    summary: node.summary,
    body: node.body,
    source: node.source,
    sourceType: node.sourceType,
    confidence: node.confidence,
  });

  // Add YAML-style frontmatter for machine readability
  const frontmatter = [
    '---',
    `id: ${node.id}`,
    `type: ${node.type}`,
    `category: ${node.category}`,
    `source: ${node.source}`,
    `sourceType: ${node.sourceType}`,
    `confidence: ${node.confidence}`,
    `created: ${new Date(node.createdAt).toISOString()}`,
    `updated: ${new Date(node.updatedAt).toISOString()}`,
    node.tags.length > 0 ? `tags: [${node.tags.join(', ')}]` : 'tags: []',
    node.connections.length > 0 ? `connections: [${node.connections.join(', ')}]` : 'connections: []',
    '---',
    '',
  ].join('\n');

  return frontmatter + normalisedBody;
}

/**
 * Generate a safe filename from a node title.
 * "Equinix FR5 — Frankfurt, Germany" → "equinix-fr5-frankfurt-germany.md"
 */
export function nodeToFilename(node: { title: string; type: string }): string {
  const safe = node.title
    .toLowerCase()
    .replace(/[—–]/g, '-')       // em/en dashes
    .replace(/[^a-z0-9\s-]/g, '') // strip special chars
    .replace(/\s+/g, '-')         // spaces to hyphens
    .replace(/-{2,}/g, '-')       // collapse multiple hyphens
    .replace(/^-|-$/g, '')        // trim hyphens
    .substring(0, 80);            // max length

  return `${node.type}--${safe}.md`;
}

/**
 * Export the entire knowledge base as a map of filename → content.
 * Used by the server endpoint and the client-side export function.
 */
export function exportKnowledgeBase(nodes: KnowledgeNode[]): Map<string, string> {
  const files = new Map<string, string>();

  // Create an index file
  const indexLines = [
    '# Broggo 2.0 Knowledge Base',
    '',
    `**Total Nodes:** ${nodes.length}`,
    `**Exported:** ${new Date().toISOString()}`,
    '',
    '## Index',
    '',
    '| File | Type | Category | Title |',
    '|------|------|----------|-------|',
  ];

  for (const node of nodes) {
    const filename = nodeToFilename(node);
    const content = nodeToMarkdownFile(node);
    files.set(filename, content);
    indexLines.push(`| [${filename}](./${filename}) | ${node.type} | ${node.category} | ${node.title} |`);
  }

  indexLines.push('');
  indexLines.push('---');
  indexLines.push('*Generated by Broggo 2.0 Intelligence Engine*');

  files.set('_index.md', indexLines.join('\n'));

  return files;
}
