import React from 'react';

interface NavbarProps {
  currentPlayerName: string;
}

const Navbar: React.FC<NavbarProps> = ({ currentPlayerName }) => {
  return (
    <nav className="navbar">
      <h1>Grabble</h1>
      <div className="turn-indicator">{currentPlayerName}'s Turn</div>
      <button className="menu-btn">☰</button>
    </nav>
  );
};

export default Navbar;

