import React from 'react';
import type { Tile } from '../types';
import { UI_MESSAGES } from '../constants/messages';

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
        <h2>{UI_MESSAGES.swap.title}</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          {UI_MESSAGES.swap.description(selectedTiles.length)}
        </p>
        
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          background: '#f5f5f5', 
          borderRadius: '8px' 
        }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
            {UI_MESSAGES.swap.tilesToSwap}
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
                <div style={{ fontSize: '0.7rem', color: '#666' }}>{tile.points} {UI_MESSAGES.swap.points}</div>
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
            {UI_MESSAGES.buttons.cancel}
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            style={{ flex: 1 }}
          >
            {UI_MESSAGES.buttons.confirmSwap}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapConfirmModal;

