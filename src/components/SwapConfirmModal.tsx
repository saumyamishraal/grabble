import React from 'react';
import type { Tile } from '../types';

interface SwapConfirmModalProps {
  isOpen: boolean;
  selectedTiles: Tile[];
  onConfirm: () => void;
  onCancel: () => void;
}

const SwapConfirmModal: React.FC<SwapConfirmModalProps> = ({ 
  isOpen, 
  selectedTiles, 
  onConfirm, 
  onCancel 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal show" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Confirm Swap Tiles</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          You are about to swap {selectedTiles.length} tile{selectedTiles.length !== 1 ? 's' : ''}. 
          This will end your turn.
        </p>
        
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          background: '#f5f5f5', 
          borderRadius: '8px' 
        }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
            Tiles to swap:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {selectedTiles.map((tile, index) => (
              <div
                key={index}
                style={{
                  padding: '0.5rem',
                  background: 'white',
                  border: '2px solid #2196f3',
                  borderRadius: '6px',
                  minWidth: '50px',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}
              >
                <div>{tile.letter}</div>
                <div style={{ fontSize: '0.7rem', color: '#666' }}>{tile.points} pts</div>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            style={{ flex: 1 }}
          >
            Confirm Swap
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapConfirmModal;

