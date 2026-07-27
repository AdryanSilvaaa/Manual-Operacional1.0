// Usa a variacao branca em fundos institucionais e azul-escuro em superficies claras.
export default function BrandLogo({ compact = false, light = false }) {
  const image = light ? '/brand/logo_duplo-Branco.png' : '/brand/logo_duplo-azul escuro.png';
  return <div className={`brand-logo ${compact ? 'brand-logo-compact' : ''}`} aria-label="Plenna Saúde Odonto">
    <img src={image} alt="Plenna Saúde Odonto" />
  </div>;
}
