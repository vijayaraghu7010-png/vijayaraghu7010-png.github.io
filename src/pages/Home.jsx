import HeroSection from '../components/HeroSection';
import CategorySection from '../components/CategorySection';
import BenefitsStrip from '../components/BenefitsStrip';
import Newsletter from '../components/Newsletter';
import usePageMeta from '../hooks/usePageMeta';

export default function Home() {
  usePageMeta(
    null,
    'Personalised magazines from ₹200, polaroid prints at ₹6 each and handcrafted bouquets. Make every memory bloom with WrappedStudio.'
  );

  return (
    <>
      <HeroSection />
      <CategorySection />
      <BenefitsStrip />
      <Newsletter />
    </>
  );
}
