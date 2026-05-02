import Intro from "@/components/Intro";
import Hero from "@/components/Hero";
import WhyFanus from "@/components/WhyFanus";
import HowItWorks from "@/components/HowItWorks";
import HomeAbout from "@/components/HomeAbout";
import Stats from "@/components/Stats";
import Psychologists from "@/components/Psychologists";
import Trust from "@/components/Trust";
import Announcements from "@/components/Announcements";
import BlogPreview from "@/components/BlogPreview";
import FAQ from "@/components/FAQ";
import ContactSection from "@/components/ContactSection";
import FinalCTA from "@/components/FinalCTA";
import {
  getPsychologists,
  getStats,
  getAnnouncements,
  getBlogPosts,
  getFaqs,
  getTestimonials,
} from "@/lib/api";

export default async function HomePage() {
  const [psychologists, stats, announcements, blogPosts, faqs, testimonials] =
    await Promise.all([
      getPsychologists().catch(() => []),
      getStats().catch(() => []),
      getAnnouncements().catch(() => []),
      getBlogPosts().catch(() => []),
      getFaqs().catch(() => []),
      getTestimonials().catch(() => []),
    ]);

  return (
    <>
      <Intro />
      <Hero />
      <WhyFanus />
      <HowItWorks />
      <HomeAbout />
      <Stats stats={stats} />
      <Psychologists psychologists={psychologists} />
      <Trust testimonials={testimonials} />
      <Announcements announcements={announcements} />
      <BlogPreview posts={blogPosts} />
      <FAQ faqs={faqs} />
      <ContactSection />
      <FinalCTA />
    </>
  );
}
