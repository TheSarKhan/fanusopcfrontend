import Hero from "@/components/Hero";
import WhyFanus from "@/components/WhyFanus";
import HowItWorks from "@/components/HowItWorks";
import Psychologists from "@/components/Psychologists";
import Testimonials from "@/components/Testimonials";
import Articles from "@/components/Articles";
import FAQ from "@/components/FAQ";
import {
  getPsychologists,
  getBlogPosts,
  getFaqs,
  getTestimonials,
} from "@/lib/api";

export default async function HomePage() {
  const [psychologists, blogPosts, faqs, testimonials] = await Promise.all([
    getPsychologists().catch(() => []),
    getBlogPosts().catch(() => []),
    getFaqs().catch(() => []),
    getTestimonials().catch(() => []),
  ]);

  return (
    <div className="fanus-root">
      <Hero />
      <WhyFanus />
      <HowItWorks />
      <Psychologists psychologists={psychologists} />
      <Testimonials testimonials={testimonials} />
      <Articles posts={blogPosts} />
      <FAQ faqs={faqs} />
    </div>
  );
}
