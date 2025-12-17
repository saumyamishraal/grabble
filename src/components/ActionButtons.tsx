import React from 'react';

interface ActionButtonsProps {
  canSubmit: boolean;
  onSubmit: () => void;
  onSwap: () => void;
  canSwap: boolean;
  wordDirection: 'horizontal' | 'vertical' | 'diagonal' | null;
  onDirectionChange: (direction: 'horizontal' | 'vertical' | 'diagonal' | null) => void;
  hasWordSelected: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  canSubmit, 
  onSubmit, 
  onSwap, 
  canSwap,
  wordDirection,
  onDirectionChange,
  hasWordSelected
}) => {
  return (
    <div className="action-buttons">
      {hasWordSelected && (
        <div className="word-direction-selector">
          <label>Word Direction:</label>
          <div className="direction-buttons">
            <button
              className={`direction-btn ${wordDirection === 'horizontal' ? 'active' : ''}`}
              onClick={() => onDirectionChange('horizontal')}
            >
              →
            </button>
            <button
              className={`direction-btn ${wordDirection === 'vertical' ? 'active' : ''}`}
              onClick={() => onDirectionChange('vertical')}
            >
              ↓
            </button>
            <button
              className={`direction-btn ${wordDirection === 'diagonal' ? 'active' : ''}`}
              onClick={() => onDirectionChange('diagonal')}
            >
              ↘
            </button>
          </div>
        </div>
      )}
      <div className="action-buttons-row">
        <button 
          className="btn btn-primary" 
          onClick={onSubmit}
          disabled={!canSubmit || (hasWordSelected && !wordDirection)}
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

