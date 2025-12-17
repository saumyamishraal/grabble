import React from 'react';

interface ActionButtonsProps {
  canSubmit: boolean;
  onSubmit: () => void;
  onSwap: () => void;
  canSwap: boolean;
  recognizedWords: string[];
  hasWordSelected: boolean;
  onClearSelection?: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  canSubmit, 
  onSubmit, 
  onSwap, 
  canSwap,
  recognizedWords,
  hasWordSelected,
  onClearSelection
}) => {
  return (
    <div className="action-buttons">
      {recognizedWords.length > 0 && (
        <div className="recognized-words">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label>Selected Words:</label>
            {onClearSelection && (
              <button
                className="btn-clear-selection"
                onClick={onClearSelection}
                title="Clear selection"
                type="button"
              >
                Clear
              </button>
            )}
          </div>
          <div className="words-display">
            {recognizedWords.join(', ').toUpperCase()}
          </div>
        </div>
      )}
      <div className="action-buttons-row">
        <button 
          className="btn btn-primary" 
          onClick={onSubmit}
          disabled={!canSubmit || !hasWordSelected}
        >
          Submit Move
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={onSwap}
          disabled={!canSwap}
        >
          Swap Tiles
        </button>
      </div>
    </div>
  );
};

export default ActionButtons;

