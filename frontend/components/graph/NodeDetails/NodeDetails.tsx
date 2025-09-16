import React, { useState, useEffect } from 'react';
import { GraphNode, GraphNodeRelationship, GraphNodeDetails } from '../../../types/graph.types';
import { analyzeGraph } from '../../../services/graph.service';
import styles from './NodeDetails.module.css';

interface NodeDetailsProps {
  node: GraphNode | null;
  projectId?: string;
  onClose?: () => void;
  onNodeSelect?: (nodeId: string) => void;
  position?: { x: number; y: number };
}


const NodeDetails: React.FC<NodeDetailsProps> = ({
  node,
  projectId,
  onClose,
  onNodeSelect,
  position = { x: 0, y: 0 }
}) => {
  const [nodeDetails, setNodeDetails] = useState<GraphNodeDetails | null>(null);
  const [relationships, setRelationships] = useState<GraphNodeRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<keyof GraphNodeDetails | null>(null);
  const [editValue, setEditValue] = useState('');

  // Fetch detailed node information when node changes
  useEffect(() => {
    if (!node || !projectId) {
      setNodeDetails(null);
      setRelationships([]);
      return;
    }

    const fetchNodeDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        // In a real implementation, this would call a specific endpoint for node details
        // For now, we'll simulate with the existing graph analysis
        const response = await analyzeGraph({
          projectId,
          options: {
            depth: 1,
            nodeTypes: [node.type],
            includeExternal: false
          }
        });

        if (response.success && response.data) {
          // Find the specific node in the response
          const foundNode = response.data.nodes.find(n => n.id === node.id);
          if (foundNode) {
            // Create node details from the node data
            const details: GraphNodeDetails = {
              id: foundNode.id,
              label: foundNode.label,
              type: foundNode.type,
              filePath: foundNode.metadata?.filePath,
              lineNumber: foundNode.metadata?.lineNumber,
              content: foundNode.metadata?.content || '',
              relationships: [] // Will be populated below
            };

            // Extract relationships from edges
            const nodeRelationships: GraphNodeRelationship[] = [];
            response.data.edges.forEach(edge => {
              if (edge.source === node.id) {
                const targetNode = response.data.nodes.find(n => n.id === edge.target);
                if (targetNode) {
                  nodeRelationships.push({
                    id: edge.id,
                    targetNodeId: targetNode.id,
                    targetNodeLabel: targetNode.label,
                    type: edge.type,
                    direction: 'out'
                  });
                }
              } else if (edge.target === node.id) {
                const sourceNode = response.data.nodes.find(n => n.id === edge.source);
                if (sourceNode) {
                  nodeRelationships.push({
                    id: edge.id,
                    targetNodeId: sourceNode.id,
                    targetNodeLabel: sourceNode.label,
                    type: edge.type,
                    direction: 'in'
                  });
                }
              }
            });

            setNodeDetails(details);
            setRelationships(nodeRelationships);
          }
        } else {
          setError(response.error || 'Failed to fetch node details');
        }
      } catch (err) {
        setError('An error occurred while fetching node details');
        console.error('Error fetching node details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNodeDetails();
  }, [node, projectId]);

  // Handle field editing
  const startEditing = (field: keyof GraphNodeDetails, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (!nodeDetails || !editingField) return;

    setNodeDetails(prev => ({
      ...prev!,
      [editingField]: editValue
    }));

    setEditingField(null);
    setEditValue('');

    // In a real implementation, this would save to the backend
    console.log(`Updated ${editingField} to: ${editValue}`);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Handle relationship navigation
  const handleRelationshipClick = (targetNodeId: string) => {
    if (onNodeSelect) {
      onNodeSelect(targetNodeId);
    }
  };

  // Get node type icon
  const getNodeTypeIcon = (type: string) => {
    const icons = {
      file: '📄',
      function: '⚡',
      class: '🏗️',
      variable: '🔧'
    };
    return icons[type as keyof typeof icons] || '📍';
  };

  // Get relationship type icon
  const getRelationshipIcon = (type: string) => {
    const icons = {
      imports: '📥',
      calls: '📞',
      extends: '🔗',
      implements: '🔧'
    };
    return icons[type as keyof typeof icons] || '🔗';
  };

  if (!node) {
    return (
      <div className={styles.nodeDetails} style={{ left: position.x, top: position.y }}>
        <div className={styles.emptyState}>
          <p>Select a node to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={styles.nodeDetails} 
      style={{ left: position.x, top: position.y }}
    >
      <div className={styles.header}>
        <div className={styles.nodeTitle}>
          <span className={styles.nodeIcon}>{getNodeTypeIcon(node.type)}</span>
          <h3>{node.label}</h3>
        </div>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>Loading details...</div>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}

      {nodeDetails && (
        <div className={styles.content}>
          {/* Basic Information */}
          <div className={styles.section}>
            <h4>Basic Information</h4>
            <div className={styles.field}>
              <label>Type:</label>
              <span className={styles.value}>{nodeDetails.type}</span>
            </div>
            <div className={styles.field}>
              <label>ID:</label>
              <span className={styles.value}>{nodeDetails.id}</span>
            </div>
            {nodeDetails.filePath && (
              <div className={styles.field}>
                <label>File:</label>
                <span className={styles.value}>{nodeDetails.filePath}</span>
              </div>
            )}
            {nodeDetails.lineNumber && (
              <div className={styles.field}>
                <label>Line:</label>
                <span className={styles.value}>{nodeDetails.lineNumber}</span>
              </div>
            )}
          </div>

          {/* Editable Content */}
          <div className={styles.section}>
            <h4>Content</h4>
            <div className={styles.field}>
              <label>Label:</label>
              {editingField === 'label' ? (
                <div className={styles.editField}>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <button onClick={saveEdit} className={styles.saveButton}>Save</button>
                    <button onClick={cancelEdit} className={styles.cancelButton}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className={styles.editableValue}>
                  <span>{nodeDetails.label}</span>
                  <button 
                    onClick={() => startEditing('label', nodeDetails.label)}
                    className={styles.editButton}
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
            {nodeDetails.content && (
              <div className={styles.field}>
                <label>Code:</label>
                {editingField === 'content' ? (
                  <div className={styles.editField}>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={6}
                      autoFocus
                    />
                    <div className={styles.editActions}>
                      <button onClick={saveEdit} className={styles.saveButton}>Save</button>
                      <button onClick={cancelEdit} className={styles.cancelButton}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.editableValue}>
                    <pre className={styles.codeContent}>{nodeDetails.content}</pre>
                    <button 
                      onClick={() => startEditing('content', nodeDetails.content)}
                      className={styles.editButton}
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Relationships */}
          <div className={styles.section}>
            <h4>Relationships ({relationships.length})</h4>
            {relationships.length === 0 ? (
              <p className={styles.noRelationships}>No relationships found</p>
            ) : (
              <div className={styles.relationshipsList}>
                {relationships.map((rel) => (
                  <div 
                    key={rel.id} 
                    className={styles.relationshipItem}
                    onClick={() => handleRelationshipClick(rel.targetNodeId)}
                  >
                    <div className={styles.relationshipHeader}>
                      <span className={styles.relationshipIcon}>
                        {getRelationshipIcon(rel.type)}
                      </span>
                      <span className={styles.relationshipType}>{rel.type}</span>
                      <span className={styles.relationshipDirection}>
                        {rel.direction === 'out' ? '→' : '←'}
                      </span>
                    </div>
                    <div className={styles.relationshipTarget}>
                      <span className={styles.targetLabel}>{rel.targetNodeLabel}</span>
                      <span className={styles.targetId}>({rel.targetNodeId})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className={styles.section}>
            <h4>Actions</h4>
            <div className={styles.actions}>
              <button 
                className={styles.actionButton}
                onClick={() => {
                  // Navigate to file in code editor
                  if (nodeDetails.filePath) {
                    console.log(`Navigate to file: ${nodeDetails.filePath}`);
                  }
                }}
              >
                📂 Open File
              </button>
              <button 
                className={styles.actionButton}
                onClick={() => {
                  // Find all references
                  console.log(`Find references to: ${nodeDetails.id}`);
                }}
              >
                🔍 Find References
              </button>
              <button 
                className={styles.actionButton}
                onClick={() => {
                  // Show in graph
                  console.log(`Focus on node: ${nodeDetails.id}`);
                }}
              >
                🎯 Focus in Graph
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeDetails;