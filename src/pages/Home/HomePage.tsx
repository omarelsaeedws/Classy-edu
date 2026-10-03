import React from 'react'
import { Navbar } from '@/components/navigation/Navbar'
import { Hero } from '@/components/sections/Hero'
import { Features } from '@/components/sections/Features'
import { TeachersPreview } from '@/components/sections/TeachersPreview'
import { HowItWorks } from '@/components/sections/HowItWorks'
import { LocalFocus } from '@/components/sections/LocalFocus'
import { CTA } from '@/components/sections/CTA'
import { Footer } from '@/components/sections/Footer'

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] transition-colors">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <TeachersPreview />
        <HowItWorks />
        <LocalFocus />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
