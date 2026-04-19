import Hero from "@/components/Hero";
import About from "@/components/About";
import Stats from "@/components/Stats";
import HowItWorks from "@/components/HowItWorks";
import Psychologists from "@/components/Psychologists";
import Trust from "@/components/Trust";
import Announcements from "@/components/Announcements";
import BlogPreview from "@/components/BlogPreview";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <Stats />
      <HowItWorks />
      <Psychologists />
      <Trust />
      <Announcements />
      <BlogPreview />
      <FAQ />
      <FinalCTA />
    </>
  );
}
