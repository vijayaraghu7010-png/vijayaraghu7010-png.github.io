import HeroSection from '../components/HeroSection';
import CategorySection, { CategoryCard, FEATURE_CATEGORY } from '../components/CategorySection';
import BenefitsStrip from '../components/BenefitsStrip';
import CustomGiftBanner from '../components/CustomGiftBanner';
import Newsletter from '../components/Newsletter';
import usePageMeta from '../hooks/usePageMeta';

export default function Home() {
  usePageMeta(
    null,
    'Personalised magazines from ₹300, polaroid prints at ₹6 each and handcrafted bouquets. Make every memory bloom with WrappedStudio.'
  );

  return (
    <>
      <HeroSection />
      <CategorySection />
      <BenefitsStrip />
      <section className="shell section home-duo" aria-label="Hampers and custom gifts">
        <CategoryCard category={FEATURE_CATEGORY} />
        <CustomGiftBanner />
      </section>
      <Newsletter />
    </>
  );
}
