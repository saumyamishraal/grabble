import React from 'react';

interface ActionButtonsProps {
  canSubmit: boolean;
  onSubmit: () => void;
  onSwap: () => void;
  canSwap: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  canSubmit, 
  onSubmit, 
  onSwap, 
  canSwap 
}) => {
  return (
    <div className="action-buttons">
      <button 
        className="btn btn-primary" 
        onClick={onSubmit}
        disabled={!canSubmit}
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
  );
};

export default ActionButtons;

