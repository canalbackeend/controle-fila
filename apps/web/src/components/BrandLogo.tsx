import whiteLogo from "../assets/beend-tech-branca.png";
import darkLogo from "../assets/beend-tech-transparente.png";

export function BrandLogo({ onDark = false }: { onDark?: boolean }) {
  return (
    <img
      className="brand-logo"
      src={onDark ? whiteLogo : darkLogo}
      alt="Beend.tech"
      width={onDark ? 2170 : 2168}
      height={725}
    />
  );
}
