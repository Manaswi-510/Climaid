/**
 * ArcCarousel.jsx
 * Interactive circular arc carousel for the 4 climate risk categories.
 * Arranges cards along a radial curve, highlights active category,
 * supports keyboard navigation, hover scaling, and 70% glassmorphism.
 */
import React, { useState, useEffect } from 'react';
import { Flame, Waves, Droplets, TreePine, ChevronUp, ChevronDown } from 'lucide-react';

const CLIMATE_CARDS = [
  {
    id: 'heat',
    label: 'Heat Stress',
    title: 'Rising temperatures & urban heat',
    desc: 'Map surface-temperature exposure across wards, identify vulnerable populations, and plan shade and cooling interventions.',
    accent: '#FF6B4A',
    glow: 'rgba(255, 107, 74, 0.4)',
    bg: 'rgba(255, 107, 74, 0.12)',
    icon: Flame,
  },
  {
    id: 'flood',
    label: 'Drainage Screening',
    title: 'Flooding & drainage deficits',
    desc: 'Identify drainage-coverage deficits and waterway constraints that increase surface-water runoff risk during heavy rainfall.',
    accent: '#09D1C7',
    glow: 'rgba(9, 209, 199, 0.4)',
    bg: 'rgba(9, 209, 199, 0.12)',
    icon: Waves,
  },
  {
    id: 'water',
    label: 'Water Stress',
    title: 'Water supply & pipeline pressure',
    desc: 'Understand areas where water supply infrastructure faces highest demand and where conservation measures are most needed.',
    accent: '#15919B',
    glow: 'rgba(21, 145, 155, 0.4)',
    bg: 'rgba(21, 145, 155, 0.12)',
    icon: Droplets,
  },
  {
    id: 'green',
    label: 'Green Cover',
    title: 'Green-space & canopy loss',
    desc: 'Compare mapped parks, trees, and green-space coverage against ward population to identify ecological and social gaps.',
    accent: '#80EE98',
    glow: 'rgba(128, 238, 152, 0.4)',
    bg: 'rgba(128, 238, 152, 0.12)',
    icon: TreePine,
  },
];

export default function ArcCarousel() {
  const [activeIndex, setActiveIndex] = useState(1); // Default to drainage/flood or heat
  const [hoverIndex, setHoverIndex] = useState(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : CLIMATE_CARDS.length - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < CLIMATE_CARDS.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : CLIMATE_CARDS.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < CLIMATE_CARDS.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="arc-carousel-container" aria-label="Climate Risk Arc Carousel">
      {/* Carousel header controls */}
      <div className="arc-carousel-header">
        <span className="arc-carousel-badge">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--palette-cyan)' }} />
          Climate Risk Focus • {activeIndex + 1} of 4
        </span>

        <div className="arc-carousel-nav">
          <button
            className="arc-nav-btn"
            onClick={handlePrev}
            aria-label="Previous Climate Risk"
            title="Previous (Arrow Up)"
          >
            <ChevronUp size={16} />
          </button>
          <button
            className="arc-nav-btn"
            onClick={handleNext}
            aria-label="Next Climate Risk"
            title="Next (Arrow Down)"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Cards arranged in a curved radial arc */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
        {CLIMATE_CARDS.map((card, idx) => {
          const Icon = card.icon;
          const isActive = activeIndex === idx;
          const isHovered = hoverIndex === idx;

          // Radial arc positioning offset
          const arcOffset = [0, 8, 16, 8][idx];

          return (
            <div
              key={card.id}
              className={`arc-card pos-${idx} ${isActive ? 'active' : ''}`}
              style={{
                '--card-accent': card.accent,
                '--card-glow': card.glow,
                borderLeft: `3px solid ${card.accent}`,
                marginLeft: `${arcOffset}px`,
                zIndex: isActive ? 10 : 4 - idx,
              }}
              onClick={() => setActiveIndex(idx)}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
              role="button"
              tabIndex={0}
              aria-selected={isActive}
            >
              <div className="arc-card-tag" style={{ color: card.accent }}>
                <Icon size={14} style={{ filter: `drop-shadow(0 0 6px ${card.glow})` }} />
                <span>{card.label}</span>
              </div>
              <div className="arc-card-title">{card.title}</div>
              <div className="arc-card-desc">{card.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
