import Hero from "@/components/Hero";
import About from "@/components/About";
import Stats from "@/components/Stats";
import Services from "@/components/Services";
import Psychologists from "@/components/Psychologists";
import Trust from "@/components/Trust";
import Announcements from "@/components/Announcements";
import BlogPreview from "@/components/BlogPreview";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Intro from "@/components/Intro";
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
      <About />
      <Stats stats={stats} />
      <Services />
      <Psychologists psychologists={psychologists} />
      <Trust testimonials={testimonials} />
      <Announcements announcements={announcements} />
      <BlogPreview posts={blogPosts} />
      <FAQ faqs={faqs} />
      <FinalCTA />
    </>
  );
}
