import Hero from "@/components/Hero";
import About from "@/components/About";
import Stats from "@/components/Stats";
import Psychologists from "@/components/Psychologists";
import Trust from "@/components/Trust";
import Announcements from "@/components/Announcements";
import BlogPreview from "@/components/BlogPreview";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Intro from "@/components/Intro";

export default function HomePage() {
  return (
    <>
      <Intro />
      <Hero />
      <About />
      <Stats />
      <Psychologists />
      <Trust />
      <Announcements />
      <BlogPreview />
      <FAQ />
      <FinalCTA />
    </>
  );
}
