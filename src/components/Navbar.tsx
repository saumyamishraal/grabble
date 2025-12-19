import React, { useState, useRef, useEffect } from 'react';
import { UI_MESSAGES } from '../constants/messages';

interface NavbarProps {
  currentPlayerName: string;
  onStartNewGame: () => void;
  onClearBoard: () => void;
  onToggleSound: () => void;
  soundEnabled: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ 
  currentPlayerName, 
  onStartNewGame, 
  onClearBoard, 
  onToggleSound,
  soundEnabled 
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking/touching outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [menuOpen]);

  const handleStartNewGame = () => {
    setMenuOpen(false);
    onStartNewGame();
  };

  const handleClearBoard = () => {
    setMenuOpen(false);
    onClearBoard();
  };

  const handleToggleSound = () => {
    setMenuOpen(false);
    onToggleSound();
  };

  return (
    <>
    <nav className="navbar">
        <div className="navbar-left">
      <h1>{UI_MESSAGES.navbar.title}</h1>
        </div>
        <div className="turn-indicator">{currentPlayerName}</div>
        <div className="navbar-right" ref={menuRef}>
          <button 
            className="info-btn" 
            onClick={() => setInfoOpen(true)}
            aria-label={UI_MESSAGES.navbar.howToPlay}
            title={UI_MESSAGES.navbar.howToPlay}
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 160 160" fill="currentColor">
              <path d="m80 15c-35.88 0-65 29.12-65 65s29.12 65 65 65 65-29.12 65-65-29.12-65-65-65zm0 10c30.36 0 55 24.64 55 55s-24.64 55-55 55-55-24.64-55-55 24.64-55 55-55z"/>
              <path d="m57.373 18.231a9.3834 9.1153 0 1 1 -18.767 0 9.3834 9.1153 0 1 1 18.767 0z" transform="matrix(1.1989 0 0 1.2342 21.214 28.75)"/>
              <path d="m90.665 110.96c-0.069 2.73 1.211 3.5 4.327 3.82l5.008 0.1v5.12h-39.073v-5.12l5.503-0.1c3.291-0.1 4.082-1.38 4.327-3.82v-30.813c0.035-4.879-6.296-4.113-10.757-3.968v-5.074l30.665-1.105"/>
            </svg>
          </button>
          <button 
            className="menu-btn" 
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              <button 
                className="menu-item" 
                onClick={handleStartNewGame}
              >
                {UI_MESSAGES.buttons.startNewGame}
              </button>
              <button 
                className="menu-item" 
                onClick={handleClearBoard}
              >
                {UI_MESSAGES.buttons.requestClearBoard}
              </button>
              <button 
                className="menu-item" 
                onClick={handleToggleSound}
              >
                {soundEnabled ? UI_MESSAGES.buttons.turnSoundOff : UI_MESSAGES.buttons.turnSoundOn}
              </button>
            </div>
          )}
        </div>
    </nav>
      {infoOpen && (
        <div className="modal show" onClick={() => setInfoOpen(false)}>
          <InfoModal onClose={() => setInfoOpen(false)} />
        </div>
      )}
    </>
  );
};

interface InfoModalProps {
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ onClose }) => {
  return (
    <div className="modal-content info-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>{UI_MESSAGES.navbar.howToPlayTitle}</h2>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
          <div className="info-section">
            <h3>{UI_MESSAGES.navbar.objective}</h3>
            <p>{UI_MESSAGES.navbar.objectiveDescription}</p>
          </div>
          
          <div className="info-section">
            <h3>{UI_MESSAGES.navbar.placingTiles}</h3>
            <ul>
              {UI_MESSAGES.navbar.placingTilesItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="info-section">
            <h3>{UI_MESSAGES.navbar.formingWords}</h3>
            <ul>
              {UI_MESSAGES.navbar.formingWordsItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="info-section">
            <h3>{UI_MESSAGES.navbar.removingTiles}</h3>
            <ul>
              {UI_MESSAGES.navbar.removingTilesItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="info-section">
            <h3>{UI_MESSAGES.navbar.scoring}</h3>
            <ul>
              {UI_MESSAGES.navbar.scoringItems.map((item, index) => (
                <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </div>

          <div className="info-section">
            <h3>{UI_MESSAGES.navbar.specialTiles}</h3>
            <ul>
              {UI_MESSAGES.navbar.specialTilesItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="info-section">
            <h3>{UI_MESSAGES.navbar.otherActions}</h3>
            <ul>
              {UI_MESSAGES.navbar.otherActionsItems.map((item, index) => (
                <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </div>
        </div>
      </div>
  );
};

export default Navbar;

