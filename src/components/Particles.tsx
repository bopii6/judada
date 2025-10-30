import { useMemo } from 'react';

interface ParticlesProps {
  active: boolean;
}

const PARTICLE_COUNT = 14;

export function Particles({ active }: ParticlesProps) {
  const items = useMemo(() => {
    return new Array(PARTICLE_COUNT).fill(0).map((_, index) => {
      const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      const size = 6 + Math.random() * 6;
      return {
        id: index,
        angle,
        distance,
        size,
        hue: Math.floor(120 + Math.random() * 60)
      };
    });
  }, []);

  return (
    <div className={`particles ${active ? 'particles--active' : ''}`} aria-hidden="true">
      {items.map(item => (
        <span
          key={item.id}
          className="particle"
          style={
            {
              '--x': `${Math.cos(item.angle) * item.distance}px`,
              '--y': `${Math.sin(item.angle) * item.distance}px`,
              '--size': `${item.size}px`,
              '--hue': item.hue
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default Particles;
