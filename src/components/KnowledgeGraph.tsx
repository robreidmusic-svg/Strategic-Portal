import React, { useMemo, useEffect, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { KnowledgeNode } from '../services/researchService';
import { MousePointer2 } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  operator: '#EAF2EA',
  infrastructure: '#EAF0F2',
  market: '#F2F0EA',
  regulatory: '#F2EAEA',
  commercial: '#F2EAF2',
};

interface KnowledgeGraphProps {
  nodes: KnowledgeNode[];
  onNodeClick: (node: KnowledgeNode) => void;
}

export function KnowledgeGraph({ nodes, onNodeClick }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height: height || 600 });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const graphData = useMemo(() => {
    const gNodes: any[] = [];
    const gLinks: any[] = [];
    const nodeSet = new Set<string>();

    nodes.forEach(node => {
      gNodes.push({
        id: node.id,
        name: node.title,
        val: 2,
        color: TYPE_COLORS[node.type] || '#8B5CF6',
        nodeType: 'knowledge',
        data: node,
      });
      nodeSet.add(node.id);
    });

    nodes.forEach(node => {
      if (node.connections) {
        node.connections.forEach(targetId => {
          if (nodeSet.has(targetId) && targetId !== node.id) {
            gLinks.push({
              source: node.id,
              target: targetId,
              linkType: 'backlink',
            });
          }
        });
      }
    });

    return { nodes: gNodes, links: gLinks };
  }, [nodes]);

  const handleNodeClick = (gNode: any) => {
    if (gNode.nodeType === 'knowledge' && gNode.data) {
      onNodeClick(gNode.data);
    } else {
      graphRef.current?.centerAt(gNode.x, gNode.y, 1000);
      graphRef.current?.zoom(4, 2000);
    }
  };

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge').strength(-300);
      if (graphData.nodes.length > 0) {
        setTimeout(() => {
          graphRef.current.zoomToFit(800, 100);
        }, 500);
      }
    }
  }, [graphData]);

  return (
    <div ref={containerRef} className="w-full h-full bg-app-bg rounded-[32px] overflow-hidden border border-app-border flex-1 min-h-[400px] relative">
      <ForceGraph3D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeColor="color"
        nodeRelSize={6}
        onNodeClick={handleNodeClick}
        linkColor={(link: any) => link.linkType === 'backlink' ? '#8B5CF6' : 'rgba(74, 69, 62, 0.1)'}
        linkWidth={(link: any) => link.linkType === 'backlink' ? 3 : 1}
        linkDirectionalParticles={(link: any) => link.linkType === 'backlink' ? 4 : 0}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.006}
        linkCurvature={(link: any) => link.linkType === 'backlink' ? 0.6 : 0}
        backgroundColor="#F5F2EA"
        showNavInfo={false}
      />

      <div className="absolute bottom-8 left-8 pointer-events-none bg-white/60 backdrop-blur-md px-6 py-3 rounded-full border border-app-border shadow-sm flex items-center gap-4">
        <MousePointer2 size={12} className="text-[#8B5CF6]" />
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-app-text">
          Drag: Rotate • Right Click: Pan • Scroll: Zoom
        </p>
      </div>
    </div>
  );
}
