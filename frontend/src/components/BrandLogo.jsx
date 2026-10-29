import { useBranding } from '../context/BrandingContext.jsx';

// Marca reutilizável. As imagens vêm de Configurações > Aparência; sem personalização, usa as de
// constants/branding.js (DEFAULT_LOGOS). Variação clara em fundos escuros (sidebar), escura em superfícies claras.
export default function BrandLogo({ compact = false, light = false }) {
  const { logos } = useBranding();
  const image = light ? logos.logoLight : logos.logoDark;
  return <div className={`brand-logo ${compact ? 'brand-logo-compact' : ''}`}>
    <img src={image} alt="Logo da empresa" />
  </div>;
}
