import React from 'react';

interface ActionButtonsProps {
  canSubmit: boolean;
  onSubmit: () => void;
  onSwap: () => void;
  canSwap: boolean;
  recognizedWords: string[];
  hasWordSelected: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  canSubmit, 
  onSubmit, 
  onSwap, 
  canSwap,
  recognizedWords,
  hasWordSelected
}) => {
  return (
    <div className="action-buttons">
      {recognizedWords.length > 0 && (
        <div className="recognized-words">
          <label>Selected Words:</label>
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

